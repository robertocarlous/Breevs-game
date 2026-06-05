"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Open_Sans } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGameStatus,
  useIsGameCreator,
  useSpinRound,
  useAdvanceRound,
  useClaimPrize,
  useIsPrizeClaimed,
  useCancelGame,
} from "@/hooks/useGame";
import { GameStatus, getCeloBlockNumber, publicClient, CONTRACT_ADDRESS, BREEVS_ABI, MIN_STAKE } from "@/lib/contractCalls";
import { formatEther, parseAbiItem, parseEventLogs } from "viem";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import Link from "next/link";
import StakeModal from "@/component/StakeModal";
import { useGameStore } from "@/store/gameStore";
import AICommentaryBox from "@/component/AICommentaryBox";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

interface Player {
  name: string;
  address: string;
  status: "Still in" | "Eliminated";
  eliminatedInRound?: number;
}

interface WinnerAnnouncement {
  address: string;
  amount: string;
}

interface WheelOfFortuneProps {
  gameId: bigint;
}

const WheelOfFortune: React.FC<WheelOfFortuneProps> = ({ gameId }) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinnerAnnouncement[]>([]);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastEliminatedPlayer, setLastEliminatedPlayer] = useState<string | null>(null);
  const [eliminationFlash, setEliminationFlash] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [eliminatedMap, setEliminatedMap] = useState<Map<string, number>>(new Map());
  const playerInfoRef = useRef(new Map<string, { addr: string; name: string }>());
  const spinActiveRef = useRef(false);
  const liveRotationRef = useRef(0);
  // Stable snapshot of the full player list — keeps the polling closure non-stale
  const allPlayersRef = useRef<string[]>([]);
  const [currentBlockNumber, setCurrentBlockNumber] = useState<number>(0);
  const [showCommentary, setShowCommentary] = useState(false);
  const [commentaryTrigger, setCommentaryTrigger] = useState(0);
  const [commentaryEventType, setCommentaryEventType] = useState<string>("game_started");

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { setSelectedGame, updateGameStatus } = useGameStore();

  const {
    data: game,
    isLoading: isLoadingStatus,
    isError,
    error: gameError,
    refetch,
  } = useGameStatus(gameId);

  const { data: isGameCreator } = useIsGameCreator(gameId, address || "");

  const { mutateAsync: spinRound, isPending: isSpinTx } = useSpinRound();
  const { mutateAsync: advanceRound, isPending: isAdvancing } = useAdvanceRound();
  const { mutateAsync: claimPrize, isPending: isClaiming } = useClaimPrize();
  const { mutateAsync: cancelGame, isPending: isCancelling } = useCancelGame();
  const { data: isPrizeClaimed } = useIsPrizeClaimed(gameId, address || "");

  if (!gameId) {
    return (
      <BackgroundImgBlur>
        <div className="flex flex-col justify-center items-center min-h-screen text-red-400 px-4">
          <p className="text-base sm:text-lg">Invalid game ID</p>
          <Link
            href="/"
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm sm:text-base"
          >
            Back to Home
          </Link>
        </div>
      </BackgroundImgBlur>
    );
  }

  // Keep allPlayersRef current so the polling closure below is never stale
  useEffect(() => {
    if (game?.players?.length) allPlayersRef.current = game.players;
  }, [game?.players]);

  // Poll getActivePlayers every 5 s to detect eliminations.
  // This is far more reliable in the browser than getLogs (which silently fails with
  // the fallback transport). getActivePlayers is a plain view call — always works.
  // We diff it against allPlayersRef (full list) to find who got eliminated,
  // then read playerGameData for their round number.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    const poll = async () => {
      const allPlayers = allPlayersRef.current;
      if (!allPlayers.length) return;
      try {
        const active = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: BREEVS_ABI,
          functionName: "getActivePlayers",
          args: [gameId],
        })) as string[];
        if (cancelled) return;

        const activeLower = new Set(active.map((a: string) => a.toLowerCase()));
        const eliminated = allPlayers.filter((p) => !activeLower.has(p.toLowerCase()));
        if (eliminated.length === 0) return;

        // Fetch elimination round for each eliminated player in parallel
        const entries = await Promise.all(
          eliminated.map(async (player): Promise<[string, number]> => {
            const key = player.toLowerCase();
            try {
              const pd = (await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: BREEVS_ABI,
                functionName: "playerGameData",
                args: [gameId, player as `0x${string}`],
              })) as [boolean, bigint];
              return [key, Number(pd[1])];
            } catch {
              return [key, 0];
            }
          })
        );

        if (cancelled) return;

        setEliminatedMap((prev) => {
          let changed = false;
          const next = new Map(prev);
          entries.forEach(([key, round]) => {
            if (!next.has(key)) { next.set(key, round); changed = true; }
          });
          return changed ? next : prev;
        });
      } catch (err) {
        console.error("[elim-poll]", err);
      }
    };

    poll(); // immediate on mount
    const iv = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Build stable name registry from PlayerJoined events + fetch past eliminations
  useEffect(() => {
    if (!gameId || !game?.creator || currentBlockNumber === 0) return;
    const infoMap = playerInfoRef.current;
    // Use a recent window to avoid RPC block-range limits
    const fromBlock = BigInt(Math.max(0, currentBlockNumber - 50000));
    Promise.all([
      publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem("event PlayerJoined(uint256 indexed gameId, address player)"),
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem("event PlayerEliminated(uint256 indexed gameId, address player, uint256 round)"),
        fromBlock,
        toBlock: "latest",
      }),
    ])
      .then(([joinLogs, elimLogs]) => {
        // Creator is always first player (index 0 → "Host")
        const creatorKey = game.creator.toLowerCase();
        if (!infoMap.has(creatorKey))
          infoMap.set(creatorKey, { addr: game.creator, name: "Host" });

        // Subsequent players in join order → "Player 2", "Player 3", …
        let joinIdx = 0;
        (joinLogs as any[]).forEach((log) => {
          if ((log.args.gameId as bigint) !== gameId) return;
          const addr: string = log.args.player;
          const key = addr.toLowerCase();
          if (!infoMap.has(key))
            infoMap.set(key, { addr, name: `Player ${joinIdx + 2}` });
          joinIdx++;
        });

        // Seed / merge eliminated map from historical events.
        // Use functional update so we never overwrite newer state (e.g. from receipt parser).
        const seedEntries: Array<[string, number]> = [];
        (elimLogs as any[]).forEach((log) => {
          if ((log.args.gameId as bigint) !== gameId) return;
          const addr: string = log.args.player;
          const round: bigint = log.args.round;
          const key = addr.toLowerCase();
          seedEntries.push([key, Number(round)]);
          if (!infoMap.has(key)) {
            const idx = infoMap.size;
            infoMap.set(key, { addr, name: `Player ${idx + 1}` });
          }
        });
        if (seedEntries.length > 0) {
          setEliminatedMap((prev) => {
            const next = new Map(prev);
            let changed = false;
            seedEntries.forEach(([key, round]) => {
              if (!next.has(key)) { next.set(key, round); changed = true; }
            });
            return changed ? next : prev;
          });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, game?.creator, currentBlockNumber === 0]);

  const updatePlayers = useCallback(() => {
    if (!game) return;
    const infoMap = playerInfoRef.current;

    // Also register any active players we haven't seen yet
    game.players.forEach((addr, index) => {
      const key = addr.toLowerCase();
      if (!infoMap.has(key)) {
        const isCreator = game.creator && addr.toLowerCase() === game.creator.toLowerCase();
        infoMap.set(key, {
          addr,
          name: isCreator ? "Host" : `Player ${index + 1}`,
        });
      }
    });

    // Seed eliminatedMap from game.eliminatedPlayers (returned by getGameInfo via getActivePlayers diff).
    // This gives us immediate elimination detection after each refetch(), without waiting for the poll.
    if (game.eliminatedPlayers?.length) {
      setEliminatedMap((prev) => {
        let changed = false;
        const next = new Map(prev);
        game.eliminatedPlayers.forEach((addr) => {
          const key = addr.toLowerCase();
          if (!next.has(key)) {
            next.set(key, 0); // round unknown at this point; polling will fill it in
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    // All unique player keys: combine active list + event-tracked eliminated
    // eliminatedMap takes priority — a player in it is always "Eliminated"
    // regardless of whether stale game.players still includes them
    const activeLower = game.players.map((a) => a.toLowerCase());
    const elimKeys = [...eliminatedMap.keys()];
    const allKeys = [...new Set([...activeLower, ...elimKeys])];

    const formattedPlayers: Player[] = allKeys.map((key) => {
      const info = infoMap.get(key);
      const addr = info?.addr ?? game.players.find((a) => a.toLowerCase() === key) ?? key;
      const name = info?.name ?? "Player ?";
      // eliminatedMap wins over game.players — handles stale RPC data
      const isEliminated = eliminatedMap.has(key);
      const eliminationRound = eliminatedMap.get(key);

      if (game.status === GameStatus.Ended && game.winner) {
        const isWinner = key === game.winner.toLowerCase();
        return {
          name,
          address: addr,
          status: (isWinner ? "Still in" : "Eliminated") as "Still in" | "Eliminated",
          eliminatedInRound: !isWinner ? (eliminationRound ?? game.currentRound) : undefined,
        };
      }

      return {
        name,
        address: addr,
        status: (isEliminated ? "Eliminated" : "Still in") as "Still in" | "Eliminated",
        eliminatedInRound: eliminationRound,
      };
    });

    setPlayers(formattedPlayers);
    if (game.status === GameStatus.Ended && game.winner) {
      const winnerPlayer = formattedPlayers.find(
        (p) => p.address.toLowerCase() === game.winner?.toLowerCase()
      );
      if (winnerPlayer) setWinner(winnerPlayer.name);
    }
  }, [game, eliminatedMap]);

  useEffect(() => { updatePlayers(); }, [updatePlayers]);

  // Auto-show commentary when game data first loads
  const autoShownRef = useRef(false);
  useEffect(() => {
    if (game && !autoShownRef.current) {
      autoShownRef.current = true;
      const eventType =
        game.status === GameStatus.Ended ? "game_ended" :
        game.status === GameStatus.InProgress ? "game_started" :
        "generic";
      setCommentaryEventType(eventType);
      setShowCommentary(true);
      setCommentaryTrigger((n) => n + 1);
    }
  }, [game]);

  // Fire "game_ended" commentary once winner is set
  const prevWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (winner && winner !== prevWinnerRef.current) {
      prevWinnerRef.current = winner;
      setCommentaryEventType("game_ended");
      setShowCommentary(true);
      setCommentaryTrigger((n) => n + 1);
    }
  }, [winner]);

  // Fetch Celo block number
  useEffect(() => {
    let isMounted = true;
    const fetch = async () => {
      try {
        const n = await getCeloBlockNumber();
        if (isMounted) setCurrentBlockNumber(n);
      } catch {}
    };
    fetch();
    const iv = setInterval(fetch, 2000); // Celo Sepolia L2 ~2s blocks
    return () => { isMounted = false; clearInterval(iv); };
  }, []);

  // Count-down timer
  useEffect(() => {
    if (!game?.roundEnd || game.status !== GameStatus.InProgress || currentBlockNumber === 0) {
      setTimeLeft(0); return;
    }
    const blocksRemaining = Math.max(0, Number(game.roundEnd) - currentBlockNumber);
    setTimeLeft(blocksRemaining * 2); // ~2s per block on Celo Sepolia L2
  }, [game?.roundEnd, game?.status, currentBlockNumber]);

  // Auto-clear status messages
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t); }
  }, [error]);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); }
  }, [success]);

  // Watch for live PlayerEliminated events
  useEffect(() => {
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: BREEVS_ABI,
      eventName: "PlayerEliminated",
      onLogs: (logs: any[]) => {
        logs.forEach((log: any) => {
          const args = log.args as { gameId: bigint; player: string; round: bigint };
          if (args.gameId === gameId) {
            setLastEliminatedPlayer(args.player);
            setEliminatedMap((prev) => {
              const next = new Map(prev);
              next.set(args.player.toLowerCase(), Number(args.round));
              return next;
            });
            const key = args.player.toLowerCase();
            if (!playerInfoRef.current.has(key)) {
              const idx = playerInfoRef.current.size;
              playerInfoRef.current.set(key, { addr: args.player, name: `Player ${idx + 1}` });
            }
          }
        });
      },
    });
    return () => unwatch();
  }, [gameId]);

  // Watch for PrizeClaimed events
  useEffect(() => {
    const unwatch = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESS,
      abi: BREEVS_ABI,
      eventName: "PrizeClaimed",
      onLogs: (logs: any[]) => {
        logs.forEach((log: any) => {
          const args = log.args as { gameId: bigint; winner: string; amount: bigint };
          if (args.gameId === gameId) {
            setWinners((prev) => [
              ...prev,
              {
                address: args.winner,
                amount: `${formatEther(args.amount)} CELO`,
              },
            ]);
          }
        });
      },
    });
    return () => unwatch();
  }, [gameId]);

  useEffect(() => {
    if (winners.length > 0) {
      const iv = setInterval(() => {
        setWinners((prev) => { const n = [...prev]; n.push(n.shift()!); return n; });
      }, 3000);
      return () => clearInterval(iv);
    }
  }, [winners]);

  const showError = (msg: string) => { setError(msg); setIsProcessing(false); };
  const showSuccess = (msg: string) => setSuccess(msg);

  const activePlayerCount = players.filter((p) => p.status === "Still in").length;

  const canSpinRound = () =>
    game?.status === GameStatus.InProgress &&
    activePlayerCount > 1 &&
    isConnected &&
    address?.toLowerCase() === game?.creator.toLowerCase() &&
    !isSpinning &&
    !isSpinTx &&
    !isProcessing &&
    (currentBlockNumber === 0 ||
      !game?.roundEnd ||
      currentBlockNumber <= Number(game.roundEnd));

  const canAdvanceRound = () =>
    game?.status === GameStatus.InProgress &&
    isConnected &&
    address?.toLowerCase() === game?.creator.toLowerCase() &&
    currentBlockNumber > 0 &&
    currentBlockNumber > Number(game?.roundEnd) &&
    !isAdvancing &&
    !isProcessing;

  const refreshGameState = async () => {
    try {
      const result = await refetch();
      // Use the fresh data from refetch (not the stale `game` closure variable)
      const freshGame = result.data;
      if (freshGame) updateGameStatus(freshGame.gameId, freshGame.status);
    } catch {}
  };

  /** Single-tx spin: host signs once, contract eliminates one player. */
  const spinRoundAction = async () => {
    if (isSpinning || isSpinTx || isProcessing || winner) return;
    setError(null);
    setIsProcessing(true);

    try {
      if (game?.status !== GameStatus.InProgress) throw new Error("Game is not in progress");
      const activePlayers = players.filter((p) => p.status === "Still in");
      if (activePlayers.length <= 1) throw new Error("Not enough players to spin");
      if (address?.toLowerCase() !== game?.creator.toLowerCase())
        throw new Error("Only the game host can trigger a spin");
      if (game?.roundEnd && currentBlockNumber > 0 && currentBlockNumber >= Number(game.roundEnd))
        throw new Error("Round has expired — advancing…");

      setIsSpinning(true);
      showSuccess("🎰 Spinning on-chain…");
      spinActiveRef.current = true;
      liveRotationRef.current = rotation;

      const fastSpinLoop = async () => {
        while (spinActiveRef.current) {
          await new Promise((r) => setTimeout(r, 30));
          liveRotationRef.current += 20;
          setRotation(liveRotationRef.current);
        }
      };
      const spinPromise = fastSpinLoop();

      const spinResult = await spinRound({ gameId });
      const txHash = spinResult.txId as `0x${string}`;

      // Stop fast spin
      spinActiveRef.current = false;
      await spinPromise;

      // ── Read eliminated player FROM THE RECEIPT LOGS (never stale) ────────────
      // The receipt is already confirmed (writeContractAsync waited for it).
      // Parsing receipt logs is always accurate — no RPC read-after-write race.
      const gameSnapshot = game; // stable player list (players[] never shrinks)
      let eliminatedAddr: string | null = null;
      let eliminatedRound: number = gameSnapshot?.currentRound ?? 1;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
        const elimLogs = parseEventLogs({
          abi: BREEVS_ABI,
          logs: receipt.logs,
          eventName: "PlayerEliminated",
        });
        // Find the log for THIS game (receipt may contain other events)
        const thisGameLog = (elimLogs as any[]).find(
          (l) => String(l.args?.gameId) === String(gameId)
        );
        if (thisGameLog?.args) {
          eliminatedAddr = thisGameLog.args.player as string;
          eliminatedRound = Number(thisGameLog.args.round as bigint) || eliminatedRound;
        }
      } catch (logErr) {
        console.error("[spinRoundAction] receipt log parse failed:", logErr);
      }

      // ── Fallback: if receipt parsing didn't detect an eliminated player,
      // call getActivePlayers immediately and diff against the full player list ──
      if (!eliminatedAddr) {
        try {
          const active = (await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: BREEVS_ABI,
            functionName: "getActivePlayers",
            args: [gameId],
          })) as string[];
          const activeLower = new Set(active.map((a: string) => a.toLowerCase()));
          const snapshot = allPlayersRef.current;
          for (const p of snapshot) {
            const key = p.toLowerCase();
            // Player is in the full list, not active anymore, and not already in eliminatedMap
            if (!activeLower.has(key) && !eliminatedMap.has(key)) {
              eliminatedAddr = p;
              // Fetch elimination round from contract
              try {
                const pd = (await publicClient.readContract({
                  address: CONTRACT_ADDRESS,
                  abi: BREEVS_ABI,
                  functionName: "playerGameData",
                  args: [gameId, p as `0x${string}`],
                })) as [boolean, bigint];
                eliminatedRound = Number(pd[1]) || eliminatedRound;
              } catch {}
              break;
            }
          }
        } catch (fallbackErr) {
          console.error("[spinRoundAction] fallback getActivePlayers failed:", fallbackErr);
        }
      }

      // Update eliminatedMap immediately — functional update avoids stale-closure issues
      // (we never read eliminatedMap from the closure; React always passes the latest value)
      let knownElimCount = 0;
      if (eliminatedAddr) {
        const _addr = eliminatedAddr;
        const _round = eliminatedRound;
        setEliminatedMap((prev) => {
          const key = _addr.toLowerCase();
          if (prev.has(key)) { knownElimCount = prev.size; return prev; }
          const next = new Map(prev);
          next.set(key, _round);
          knownElimCount = next.size;
          return next;
        });
        setLastEliminatedPlayer(_addr);
      }

      // Refresh game state — await it so winner / GameStatus.Ended is detected immediately
      await refreshGameState();

      // ── Calculate landing angle ───────────────────────────────────────────────
      // Players occupy 6 fixed slots: slot 0 = 0°, slot 1 = 60°, etc.
      const playersSnapshot = [...players];
      let eliminatedSlotIdx = 0;
      if (eliminatedAddr) {
        const idx = playersSnapshot.findIndex(
          (p) => p.address.toLowerCase() === eliminatedAddr!.toLowerCase()
        );
        if (idx >= 0) eliminatedSlotIdx = idx;
      }

      const slotAngle = eliminatedSlotIdx * 60;
      const targetMod = (360 - slotAngle) % 360;
      const currentMod = liveRotationRef.current % 360;
      let extra = targetMod - currentMod;
      if (extra <= 0) extra += 360;

      const fromRot = liveRotationRef.current;
      const toRot = fromRot + extra + 720;

      // Decelerate smoothly (ease-out cubic) — 70 × 35 ms = ~2.5 s
      const steps = 70;
      for (let i = 0; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, 35));
        const t = i / steps;
        const eased = 1 - Math.pow(1 - t, 3);
        setRotation(fromRot + (toRot - fromRot) * eased);
      }

      // ── Impact effects ────────────────────────────────────────────────────────
      setEliminationFlash(true);
      setShaking(true);
      setTimeout(() => setEliminationFlash(false), 900);
      setTimeout(() => setShaking(false), 600);

      setIsSpinning(false);
      setIsProcessing(false);

      // Use playerInfoRef (always current — not a stale closure) for the name
      const eliminatedName = eliminatedAddr
        ? (playerInfoRef.current.get(eliminatedAddr.toLowerCase())?.name
            ?? playersSnapshot.find((p) => p.address.toLowerCase() === eliminatedAddr!.toLowerCase())?.name
            ?? `${eliminatedAddr.slice(0, 6)}...${eliminatedAddr.slice(-4)}`)
        : "A player";
      showSuccess(`💥 ${eliminatedName} has been eliminated!`);

      // Survivor count: total players minus confirmed eliminations (knownElimCount set above)
      const totalPlayers = gameSnapshot?.players?.length ?? 6;
      const activeCount = totalPlayers - knownElimCount;
      const nextEventType = activeCount === 2 ? "last_two_remaining" : "player_eliminated";
      setCommentaryEventType(nextEventType);
      setShowCommentary(true);
      setCommentaryTrigger((n) => n + 1);
    } catch (err: any) {
      spinActiveRef.current = false;
      showError(err.message || "Failed to spin");
      setIsSpinning(false);
      setIsProcessing(false);
    }
  };

  const advanceRoundAction = async () => {
    if (isProcessing || isAdvancing || winner) return;
    setError(null);
    setIsProcessing(true);
    try {
      if (game?.status !== GameStatus.InProgress) throw new Error("Game is not in progress");
      if (address?.toLowerCase() !== game?.creator.toLowerCase())
        throw new Error("Only the game host can advance");
      if (game?.roundEnd && currentBlockNumber > 0 && currentBlockNumber < Number(game.roundEnd)) {
        const left = Number(game.roundEnd) - currentBlockNumber;
        throw new Error(`Round hasn't expired yet. ~${left} blocks remaining.`);
      }
      showSuccess("⏭️ Advancing round…");
      await advanceRound({ gameId });
      await refreshGameState();
      showSuccess(`⏭️ Round ${(game?.currentRound || 0) + 1} started!`);
      setIsProcessing(false);
      setCommentaryEventType("round_advanced");
      setShowCommentary(true);
      setCommentaryTrigger((n) => n + 1);
    } catch (err: any) {
      showError(err.message || "Failed to advance round");
      setIsProcessing(false);
    }
  };

  const claimPrizeAction = async () => {
    if (isProcessing || isClaiming) return;
    setError(null); setIsProcessing(true);
    try {
      if (game?.status !== GameStatus.Ended) throw new Error("Game has not ended yet");
      if (address?.toLowerCase() !== game?.winner?.toLowerCase()) throw new Error("Only the winner can claim");
      if (isPrizeClaimed) throw new Error("Prize already claimed");
      showSuccess("🏆 Claiming your prize...");
      await claimPrize({ gameId, user: address! });
      await refreshGameState();
      if (address && game) {
        setWinners((prev) => [
          ...prev,
          { address, amount: `${(Number(game.prizePool) / 1e18).toFixed(2)} CELO` },
        ]);
      }
      showSuccess(`🎉 Prize of ${(Number(game?.prizePool) / 1e18).toFixed(2)} CELO claimed!`);
      setIsProcessing(false);
    } catch (err: any) {
      showError(err.message || "Failed to claim prize");
    }
  };

  const cancelGameAction = async () => {
    if (isProcessing || isCancelling) return;
    if (!confirm("Cancel this game? All players will be refunded.")) return;
    setError(null); setIsProcessing(true);
    try {
      await cancelGame({ gameId });
      await refreshGameState();
      showSuccess("Game cancelled — all players refunded.");
      setIsProcessing(false);
    } catch (err: any) {
      showError(err.message || "Failed to cancel game");
    }
  };

  const handleJoinGame = () => {
    if (game) { setSelectedGame(game); setIsStakeModalOpen(true); }
  };

  const isCreator = !!address && !!game?.creator && address.toLowerCase() === game.creator.toLowerCase();

  const getGameStatusText = () => {
    if (!game || isLoadingStatus) return "Loading...";
    switch (game.status) {
      case GameStatus.Active:
        return game.playerCount === 6
          ? "Lobby full — starting…"
          : `Waiting for Players (${game.playerCount}/6)`;
      case GameStatus.InProgress: return `In Progress – Round ${game.currentRound}`;
      case GameStatus.Ended: return "Game Ended";
      default: return "Unknown";
    }
  };

  const canClaimPrize = () =>
    game?.status === GameStatus.Ended &&
    isConnected &&
    address?.toLowerCase() === game?.winner?.toLowerCase() &&
    !isClaiming && !isProcessing && !isPrizeClaimed;

  const canJoinGame = () =>
    game?.status === GameStatus.Active &&
    isConnected &&
    address &&
    !game.players.map((p) => p.toLowerCase()).includes(address.toLowerCase()) &&
    game.playerCount < 6;

  if (isLoadingStatus || isError) {
    return (
      <BackgroundImgBlur>
        <div className="flex flex-col justify-center items-center min-h-screen text-white px-4">
          {isLoadingStatus && <div className="text-lg sm:text-xl animate-pulse">Loading game...</div>}
          {isError && (
            <>
              <p className="text-red-400 text-sm sm:text-base text-center">
                Error: {gameError?.message || "Failed to load game"}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm sm:text-base"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </BackgroundImgBlur>
    );
  }

  const isParticipant = !!address && !!game?.players &&
    game.players.map((p) => p.toLowerCase()).includes(address.toLowerCase());
  const isSpectator = !isParticipant;

  return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} w-full h-screen overflow-hidden flex flex-col`}>
        <StakeModal
          isOpen={isStakeModalOpen}
          onClose={() => { setIsStakeModalOpen(false); setSelectedGame(null); }}
          onSuccess={() => { setIsStakeModalOpen(false); refetch(); }}
        />

        {/* Spectator banner */}
        {isSpectator && (
          <div className="w-full bg-blue-900/30 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-blue-400 shrink-0">👁️</span>
              <p className="text-blue-300 text-xs truncate">
                {!address ? "Connect your wallet to participate in this game." : "You're watching this game as a spectator."}
              </p>
            </div>
            {!address && (
              <button
                onClick={() => openConnectModal?.()}
                className="shrink-0 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              >
                Connect
              </button>
            )}
          </div>
        )}

        {/* Top bar */}
        <div className="w-full bg-gradient-to-r from-[#030b1f] via-[#0a1529] to-[#030b1f] border-b border-red-500/20 py-3 px-4 sm:px-6 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-center sm:text-left">
              <h1 className="text-xl text-white sm:text-2xl lg:text-3xl font-bold">
                <span className="text-[#FF3B3B]">WIN</span> or LOSE
              </h1>
              <p className="text-xs sm:text-sm text-gray-300">
                Last man standing{" "}
                <span className="text-[#FF3B3B] font-bold">WINS BIG!</span>
              </p>
            </div>
            {winners.length > 0 && (
              <motion.div
                key={winners[0].address}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-red-900/40 to-red-800/40 backdrop-blur-sm rounded-lg px-3 py-2 border border-red-500/30"
              >
                <p className="text-xs text-gray-400">Latest Winner</p>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-white font-mono">
                    {winners[0].address.slice(0, 6)}...{winners[0].address.slice(-4)}
                  </span>
                  <span className="text-gray-400">won</span>
                  <span className="text-[#FF3B3B] font-bold">{winners[0].amount}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Status toasts */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
            >
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-lg shadow-2xl border border-green-400/50">
                <p className="text-sm font-semibold text-center">{success}</p>
              </div>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
            >
              <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-3 rounded-lg shadow-2xl border border-red-400/50">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-semibold flex-1">{error}</p>
                  <button onClick={() => setError(null)} className="text-white hover:text-gray-200 font-bold text-lg">×</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Russian Roulette AI — auto-pops on game events */}
        {showCommentary && (
          <AICommentaryBox
            gameId={gameId}
            eventTrigger={commentaryTrigger}
            onClose={() => setShowCommentary(false)}
            currentRound={game?.currentRound}
            activePlayers={players.filter((p) => p.status === "Still in").length || game?.playerCount}
            totalPlayers={6}
            eliminatedCount={eliminatedMap.size}
            lastEliminatedAddress={lastEliminatedPlayer}
            prizePool={game ? (Number(game.prizePool) / 1e18).toFixed(2) : undefined}
            eventType={commentaryEventType}
            lastEliminatedName={
              lastEliminatedPlayer
                ? (players.find((p) => p.address.toLowerCase() === lastEliminatedPlayer.toLowerCase())?.name ?? null)
                : null
            }
            winnerName={winner}
            activePlayerNames={players.filter((p) => p.status === "Still in").map((p) => p.name)}
            eliminationHistory={[...eliminatedMap.entries()].map(([addr, round]) => ({
              name: playerInfoRef.current.get(addr)?.name ?? `${addr.slice(0, 6)}...`,
              round,
            }))}
          />
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">

              {/* Left panel – game info & actions */}
              <div className="lg:col-span-4 xl:col-span-3">
                <div className="bg-gradient-to-br from-[#030b1f]/95 to-[#0a1529]/95 backdrop-blur-md rounded-xl border border-red-500/20 p-4 shadow-xl sticky top-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base sm:text-lg font-bold text-white">
                      Game #{gameId.toString()}
                    </h2>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        game?.status === GameStatus.Active
                          ? "bg-yellow-500/20 text-yellow-400"
                          : game?.status === GameStatus.InProgress
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {getGameStatusText()}
                    </span>
                  </div>

                  {isGameCreator && (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-300 font-semibold">🎮 You are the Game Host</p>
                    </div>
                  )}

                  {game?.status === GameStatus.InProgress && game.roundEnd && (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-gray-400">Round Time Left</p>
                      <p className={`text-xl font-bold ${timeLeft <= 60 && timeLeft > 0 ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
                        {timeLeft > 0 ? `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s` : "Expired"}
                      </p>
                      {timeLeft === 0 && <p className="text-xs text-amber-300 mt-1">⏰ Round expired – Advance!</p>}
                    </div>
                  )}

                  {game && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                        <p className="text-xs text-gray-400">Stake</p>
                        <p className="text-sm font-bold text-white">
                          {formatEther(game.stake > 0n ? game.stake : MIN_STAKE)} CELO
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                        <p className="text-xs text-gray-400">Players</p>
                        <p className="text-sm font-bold text-white">{game.playerCount}/6</p>
                      </div>
                      <div className="col-span-2 bg-gradient-to-r from-[#FF3B3B]/20 to-red-800/20 rounded-lg p-2 border border-[#FF3B3B]/30">
                        <p className="text-xs text-gray-400">Prize Pool</p>
                        <p className="text-lg sm:text-xl font-bold text-[#FF3B3B]">
                          {formatEther(game.prizePool)} CELO
                        </p>
                      </div>
                    </div>
                  )}

                  {!isConnected && (
                    <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                      <p className="text-xs text-yellow-300">Connect wallet to interact</p>
                    </div>
                  )}

                  {/* Non-creator player info */}
                  {isConnected && !isCreator && game?.status === GameStatus.Active && game.playerCount === 6 && (
                    <div className="mb-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-200 text-center">
                        ⏳ Lobby full — game starts automatically when the 6th player joins on-chain.
                      </p>
                    </div>
                  )}
                  {isConnected && !isCreator && game?.status === GameStatus.InProgress && (
                    <div className="mb-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-200 text-center">
                        🎡 The <span className="font-bold text-white">Host</span> controls the spin.<br/>
                        Watch the wheel — you could be eliminated!
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {canJoinGame() && (
                      <button
                        onClick={handleJoinGame}
                        className="block w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold py-2 px-4 rounded-lg text-center transition-all text-sm shadow-lg"
                      >
                        🎯 Join Game ({formatEther(game?.stake && game.stake > 0n ? game.stake : MIN_STAKE)} CELO)
                      </button>
                    )}
                    {game?.status === GameStatus.Active &&
                      game.playerCount === 6 &&
                      isCreator && (
                      <p className="text-xs text-center text-green-300 mb-2">
                        Game starts automatically at 6 players (no extra signature).
                      </p>
                    )}
                    {(game?.status === GameStatus.Active || game?.status === GameStatus.InProgress) && isCreator && (
                      <button
                        onClick={cancelGameAction}
                        disabled={isCancelling || isProcessing}
                        className={`w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 text-red-300 font-bold py-2 px-4 rounded-lg transition-all text-sm border border-red-500/30 ${isCancelling || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isCancelling || isProcessing ? "Cancelling..." : "✕ Cancel & Refund All"}
                      </button>
                    )}
                    {canSpinRound() && (
                      <button
                        onClick={spinRoundAction}
                        disabled={isSpinTx || isProcessing}
                        className={`w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm shadow-lg ${isSpinTx || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isSpinTx || isProcessing ? "Spinning…" : "🎡 Spin"}
                      </button>
                    )}
                    {canAdvanceRound() && (
                      <button
                        onClick={advanceRoundAction}
                        disabled={isAdvancing || isProcessing}
                        className={`w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm shadow-lg ${isAdvancing || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isAdvancing || isProcessing ? "Advancing…" : "⏭️ Advance Round"}
                      </button>
                    )}
                    {canClaimPrize() && (
                      <button
                        onClick={claimPrizeAction}
                        disabled={isClaiming || isProcessing || !!isPrizeClaimed}
                        className={`w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm shadow-lg ${isClaiming || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isClaiming || isProcessing ? "Claiming..." : "🏆 Claim Prize"}
                      </button>
                    )}
                    {isPrizeClaimed && game?.status === GameStatus.Ended && address?.toLowerCase() === game?.winner?.toLowerCase() && (
                      <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-xs text-green-300 text-center">✅ Prize Already Claimed</p>
                      </div>
                    )}

                    {/* Re-open AI commentary if user closed it */}
                    {!showCommentary && (
                      <button
                        onClick={() => {
                          setCommentaryEventType(
                            game?.status === GameStatus.Ended ? "game_ended" :
                            game?.status === GameStatus.InProgress ? "game_started" :
                            "generic"
                          );
                          setShowCommentary(true);
                          setCommentaryTrigger((n) => n + 1);
                        }}
                        className="w-full bg-gradient-to-r from-red-900/60 to-red-800/60 hover:brightness-110 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        🎰 Live Commentary
                      </button>
                    )}
                  </div>

                  {isProcessing && (
                    <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-amber-300">Processing transaction...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Centre – Revolver Cylinder */}
              <div className="lg:col-span-4 xl:col-span-5 flex items-center justify-center">
                <div className={`relative w-full max-w-xs sm:max-w-sm aspect-square sticky top-4 ${shaking ? "shake" : ""}`}>

                  {/* Full-screen elimination flash overlay */}
                  <AnimatePresence>
                    {eliminationFlash && (
                      <motion.div
                        key="flash"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.65 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="fixed inset-0 bg-red-600 z-[999] pointer-events-none"
                      />
                    )}
                  </AnimatePresence>

                  {/* Outer decorative rings */}
                  <div className="absolute inset-0 rounded-full border-2 border-red-500/30 shadow-[0_0_40px_rgba(220,38,38,0.15)]" />
                  <div className="absolute inset-[6px] rounded-full border border-red-500/10" />

                  {/* Spinning cylinder */}
                  <motion.div
                    className="absolute inset-[10px] rounded-full"
                    animate={{ rotate: rotation }}
                    transition={{ ease: "linear", duration: 0.04 }}
                    style={{
                      background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, rgba(3,11,31,0.96) 65%)",
                    }}
                  >
                    {/* 6 fixed bullet chamber slots */}
                    {Array.from({ length: 6 }).map((_, slotIdx) => {
                      const angle = slotIdx * 60;
                      const player = players[slotIdx] ?? null;
                      const isElim = player?.status === "Eliminated";
                      const isJustElim = eliminationFlash && player?.address.toLowerCase() === lastEliminatedPlayer?.toLowerCase();

                      return (
                        <div
                          key={slotIdx}
                          className="absolute"
                          style={{
                            width: 60, height: 60,
                            left: "50%", top: "50%",
                            transform: `rotate(${angle}deg) translateY(-105px) rotate(-${angle}deg) translate(-50%, -50%)`,
                          }}
                        >
                          {/* Chamber shell */}
                          <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-lg transition-all duration-300 ${
                            !player
                              ? "border-white/5 bg-white/5 text-gray-700"
                              : isJustElim
                              ? "border-red-400 bg-red-600 text-white scale-125 shadow-[0_0_24px_rgba(220,38,38,0.9)]"
                              : isElim
                              ? "border-gray-700/30 bg-gray-900/60 text-gray-600 opacity-40 scale-90"
                              : "border-red-500/70 bg-gradient-to-br from-red-900/70 to-[#030B1F] text-white chamber-active"
                          }`}>
                            {!player ? (
                              <span className="text-gray-700 text-lg">○</span>
                            ) : isElim ? (
                              <span className="text-lg">💀</span>
                            ) : (
                              <span className="text-[10px] text-center leading-tight px-0.5">
                                {player.name.replace("Player ", "P")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* Fixed pointer arrow at top */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-30">
                    <div className="w-0 h-0 border-l-[13px] border-r-[13px] border-l-transparent border-r-transparent border-t-[26px] border-t-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
                  </div>

                  {/* Centre action button */}
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-bold text-sm sm:text-base shadow-2xl cursor-pointer transition-all border-2 select-none ${
                        canSpinRound()
                          ? "bg-red-600 border-red-400 text-white hover:scale-110 glow-red"
                          : "bg-[#0B1445] border-white/10 text-gray-500 cursor-not-allowed"
                      }`}
                      onClick={canSpinRound() ? spinRoundAction : undefined}
                    >
                      {isSpinning || isSpinTx || isProcessing
                        ? <span className="animate-spin text-xl">⚙️</span>
                        : canSpinRound() ? "SPIN"
                        : game?.status === GameStatus.InProgress && !isCreator ? "LIVE"
                        : game?.status === GameStatus.Active && !isCreator ? "WAIT"
                        : "SPIN"}
                    </div>
                  </div>

                  {/* Round indicator below */}
                  {game?.status === GameStatus.InProgress && (
                    <div className="absolute -bottom-12 left-0 right-0 text-center">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Round</p>
                      <p className="text-3xl font-bold text-white">{game.currentRound}</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Right panel – players */}
              <div className="lg:col-span-4">
                <div className="bg-gradient-to-br from-[#030b1f]/95 to-[#0a1529]/95 backdrop-blur-md rounded-xl border border-red-500/20 p-4 shadow-xl sticky top-4">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-3">👥 Participants</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400 mb-2">Players ({activePlayerCount} active / {game?.playerCount || 0} total)</p>
                    {players.length === 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-400">Waiting for players to join...</p>
                      </div>
                    )}
                    {players.map((player, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: player.status === "Eliminated" ? 0.5 : 1 }}
                        className={`bg-white/5 border rounded-lg p-2 transition-all ${
                          player.status === "Eliminated" ? "border-red-500/30" : "border-green-500/30"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className={`text-xs sm:text-sm font-semibold ${player.status === "Eliminated" ? "line-through text-gray-500" : "text-white"}`}>
                              {player.name}
                              {player.address.toLowerCase() === game?.creator.toLowerCase() && " (Host)"}
                            </p>
                            <p className="text-xs text-gray-400 font-mono mt-1">
                              {player.address.slice(0, 6)}...{player.address.slice(-4)}
                            </p>
                            {player.eliminatedInRound && (
                              <p className="text-xs text-red-400 mt-1">❌ Round {player.eliminatedInRound}</p>
                            )}
                            {address?.toLowerCase() === player.address.toLowerCase() && (
                              <p className="text-xs text-amber-300 mt-1">🫵 You</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                            player.status === "Still in"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {player.status}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {winner && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                      className="mt-4 p-3 bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50 rounded-lg"
                    >
                      <h3 className="text-base font-bold text-green-300 mb-1">🎉 Winner!</h3>
                      <p className="text-sm text-green-200">
                        {winner} wins {(Number(game?.prizePool) / 1e18).toFixed(2)} CELO!
                      </p>
                      {address?.toLowerCase() === game?.winner?.toLowerCase() && !isPrizeClaimed && (
                        <p className="text-xs text-yellow-300 mt-2">👆 Claim your prize above!</p>
                      )}
                    </motion.div>
                  )}

                  {game?.status === GameStatus.Active && isGameCreator && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-xs text-amber-300">
                        ℹ️ Waiting for 6 players. Once full, start the game!
                      </p>
                    </div>
                  )}

                  {game?.status === GameStatus.InProgress && isCreator && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-1.5">
                      {canAdvanceRound() ? (
                        <p className="text-xs text-orange-300">
                          ⏰ Round expired — click <strong>Advance Round</strong> first, then <strong>Spin</strong>.
                        </p>
                      ) : (
                        <p className="text-xs text-yellow-300">
                          ℹ️ Click <strong>Spin</strong>, wait ~5 sec (1 block), then click <strong>GO!</strong> to eliminate a player.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );
};

export default WheelOfFortune;
