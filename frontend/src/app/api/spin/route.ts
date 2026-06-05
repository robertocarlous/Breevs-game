import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { BREEVS_ABI } from "@/lib/BreevsABI";

// contractCalls.ts is "use client" — read address from env on the server
const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
) as `0x${string}`;

const REVEAL_DELAY = 1n;
const MAX_WAIT_MS = 45_000;
const POLL_MS = 800;

function parseRelayerKey(): Hex | null {
  const raw = process.env.SPIN_RELAYER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  const hex = raw.startsWith("0x") ? raw : `0x${raw.replace(/^=+/, "")}`;
  if (hex.length !== 66) return null;
  return hex as Hex;
}

function getPublicClient() {
  const urls = [
    "https://forno.celo.org",
    process.env.NEXT_PUBLIC_CELO_RPC_URL,
    process.env.CELO_RPC_URL,
  ].filter(Boolean) as string[];

  return createPublicClient({
    chain: celo,
    transport: fallback(urls.map((url) => http(url))),
  });
}

async function waitForBlock(
  client: ReturnType<typeof getPublicClient>,
  target: bigint
) {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    const n = await client.getBlockNumber();
    if (n >= target) return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Timed out waiting for on-chain reveal block");
}

export async function POST(req: NextRequest) {
  const key = parseRelayerKey();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Spin relayer not configured (set SPIN_RELAYER_PRIVATE_KEY on the server)" },
      { status: 503 }
    );
  }

  let body: { gameId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const gameId = body.gameId ? BigInt(body.gameId) : 0n;
  if (gameId <= 0n) {
    return NextResponse.json({ ok: false, error: "Invalid gameId" }, { status: 400 });
  }

  const action = body.action === "advance" ? "advance" : "execute";
  const account = privateKeyToAccount(key);
  const publicClient = getPublicClient();
  const rpc = process.env.CELO_RPC_URL || process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org";
  const wallet = createWalletClient({ account, chain: celo, transport: http(rpc) });

  // Inline spin call — avoids generic type loss from helper function parameter
  const spin = (gId: bigint) =>
    wallet.writeContract({ address: CONTRACT_ADDRESS, abi: BREEVS_ABI, functionName: "spin", args: [gId], chain: celo });

  try {
    if (action === "advance") {
      const hash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: BREEVS_ABI,
        functionName: "advanceRound",
        args: [gameId],
        chain: celo,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return NextResponse.json({ ok: true, advanceTxHash: hash });
    }

    const pending = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BREEVS_ABI,
      functionName: "getPendingSpin",
      args: [gameId],
    })) as { pending: boolean; commitBlock: bigint; round: bigint };

    let commitTxHash: Hex | undefined;
    let resolveTxHash: Hex | undefined;

    if (!pending.pending) {
      commitTxHash = await spin(gameId);
      await publicClient.waitForTransactionReceipt({ hash: commitTxHash });

      const afterCommit = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: BREEVS_ABI,
        functionName: "getPendingSpin",
        args: [gameId],
      })) as { pending: boolean; commitBlock: bigint };

      if (!afterCommit.pending) {
        return NextResponse.json({
          ok: true,
          commitTxHash,
          error: "Commit did not leave a pending spin (game may have ended)",
        });
      }

      await waitForBlock(publicClient, afterCommit.commitBlock + REVEAL_DELAY);
    } else {
      await waitForBlock(publicClient, pending.commitBlock + REVEAL_DELAY);
    }

    resolveTxHash = await spin(gameId);
    await publicClient.waitForTransactionReceipt({ hash: resolveTxHash });

    return NextResponse.json({ ok: true, commitTxHash, resolveTxHash });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Spin relayer transaction failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
