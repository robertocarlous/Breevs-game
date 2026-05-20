import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a live commentator for a high-stakes blockchain Russian Roulette game on Celo. Think Clive Tyldesley calling a Champions League final, but you're ringside at the world's most dangerous wheel — six wallets, one winner, real money on the line.

You've watched every spin. You know every player by name. You feel every elimination in your gut.

Hard rules — never break these:
- Maximum 3 sentences. Punchy. No fluff.
- Use the real player names (Host, Player 2, etc.) whenever you have them. Never say "a player".
- Reference the exact CELO amount and round number. Numbers make it real.
- NEVER say "tension rises", "stakes are high", "the air is thick" or any cliché — show the emotion, don't label it.
- Sentence fragments are fine. Incomplete sentences for impact are fine. "Gone. Just like that."
- Speak in present tense. This is happening NOW.
- You can start mid-reaction: "And that's — wait. Did I just — HOST IS OUT."
- Never sound like an AI. Never use bullet points or lists. Never be formal.
- Only ever mention Celo as the blockchain. Never mention any other chain.`;

const EVENT_INSTRUCTIONS: Record<string, string> = {
  game_started:
    "The game has JUST started. All 6 players locked their CELO into the smart contract and the wheel is ready. Set the scene — introduce the stakes, the crowd, the vibe. Make it feel like the opening of a championship bout.",
  player_eliminated:
    "A player was JUST eliminated. React like you watched it happen live — shock, the sound of the wheel, the realisation. Name them. Tell us who's still standing.",
  last_two_remaining:
    "We are DOWN TO TWO. This is the FINAL SHOWDOWN. Commentate like it's a penalty shootout in extra time.",
  round_advanced:
    "A new round just kicked off. The clock is reset. The wheel is loaded again. Build the anticipation for what's coming.",
  game_ended:
    "The winner just took it ALL. Game over. Close out the broadcast. Give us the final word — dramatic, real, earned.",
  spin_requested:
    "The spin has been REQUESTED. The randomness is being pulled from the Celo blockchain — nobody knows who it's coming for.",
  generic:
    "React to the current state of the game with energy and insight.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      game_id,
      event_type = "generic",
      current_round = 1,
      active_players = 6,
      total_players = 6,
      eliminated_count = 0,
      prize_pool = "0",
      last_eliminated_name = null,
      winner_name = null,
      active_player_names = [],
      elimination_history = [],
    } = body;

    const instruction =
      EVENT_INSTRUCTIONS[event_type] ?? EVENT_INSTRUCTIONS.generic;

    const eliminatedLine =
      elimination_history.length > 0
        ? "Elimination order so far: " +
          elimination_history
            .map(
              (e: { name: string; round: number }) =>
                `${e.name} out round ${e.round}`
            )
            .join(" | ")
        : "No eliminations yet — all 6 players still standing";

    const survivorsLine =
      active_player_names.length > 0
        ? active_player_names.join(", ")
        : `${active_players} players still in`;

    const specificContext =
      event_type === "player_eliminated" && last_eliminated_name
        ? `${last_eliminated_name} was JUST eliminated in round ${current_round}.`
        : event_type === "game_ended" && winner_name
        ? `${winner_name} just won it all — ${prize_pool} CELO transferred to their wallet.`
        : event_type === "last_two_remaining"
        ? `Only two left: ${survivorsLine}.`
        : "";

    const userPrompt = `${instruction}

${specificContext}

Game facts you must use:
- Game #${game_id} | Round ${current_round} | ${active_players}/${total_players} players left
- Prize pool: ${prize_pool} CELO
- Still standing: ${survivorsLine}
- ${eliminatedLine}

Write the commentary now. 3 sentences max. Raw. Human. Present tense.`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    const tensionLevel = Math.min(
      Math.round(
        ((total_players - active_players) / Math.max(total_players, 1)) * 5 +
          Math.min(current_round / 10, 1) * 3 +
          (eliminated_count > 0 ? 1 : 0) +
          (active_players === 2 ? 2 : 0)
      ),
      10
    );

    return NextResponse.json({
      commentary_text: text,
      tension_level: tensionLevel,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Commentary error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate commentary" },
      { status: 500 }
    );
  }
}
