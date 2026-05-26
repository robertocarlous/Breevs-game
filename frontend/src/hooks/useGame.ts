"use client";

import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { useWriteContract, useAccount, useSwitchChain, useChainId } from "wagmi";
import { celo } from "wagmi/chains";
import { parseEventLogs } from "viem";
import { useState } from "react";
import {
  publicClient,
  BREEVS_ABI,
  getGameInfo,
  getPlayerData,
  getUserStats,
  getTotalGames,
  isPrizeClaimed,
  isUserInGame,
  isGameCreator,
  getPendingSpin,
  createGameArgs,
  cancelGameArgs,
  joinGameArgs,
  startGameArgs,
  requestSpinArgs,
  resolveSpinArgs,
  advanceRoundArgs,
  claimPrizeArgs,
  mapContractError,
  GameStatus,
  GameInfo,
  PlayerData,
  UserStats,
  SpinRequest,
} from "@/lib/contractCalls";
import { useGameStore } from "@/store/gameStore";
import { useEffect } from "react";

// ─── Re-export types so components don't need to import from two places ────────
export { GameStatus };
export type { GameInfo, PlayerData, UserStats, SpinRequest };

// ─────────────────────────────────────────────────────────────────────────────
// READ HOOKS
// ─────────────────────────────────────────────────────────────────────────────

export function useGameInfo(gameId: bigint) {
  return useQuery<GameInfo, Error>({
    queryKey: ["gameInfo", gameId.toString()],
    queryFn: () => getGameInfo(gameId),
    enabled: !!gameId && gameId > 0n,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useGamePlayer(gameId: bigint, player: string) {
  return useQuery<PlayerData, Error>({
    queryKey: ["gamePlayer", gameId.toString(), player],
    queryFn: () => getPlayerData(gameId, player),
    enabled: !!gameId && !!player,
  });
}

export function useUserStats(user: string) {
  return useQuery<UserStats, Error>({
    queryKey: ["userStats", user],
    queryFn: () => getUserStats(user),
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useTotalGames() {
  return useQuery<bigint, Error>({
    queryKey: ["totalGames"],
    queryFn: getTotalGames,
    staleTime: 60000,
  });
}

export function useIsPrizeClaimed(gameId: bigint, _user: string) {
  return useQuery<boolean, Error>({
    queryKey: ["isPrizeClaimed", gameId.toString()],
    queryFn: () => isPrizeClaimed(gameId, _user),
    enabled: !!gameId && gameId > 0n,
    staleTime: 60_000,
  });
}

export function useIsGameCreator(gameId: bigint, user: string) {
  return useQuery<boolean, Error>({
    queryKey: ["isGameCreator", gameId.toString(), user],
    queryFn: () => isGameCreator(gameId, user),
    enabled: !!gameId && !!user,
  });
}

export function useIsUserInGame(gameId: bigint, user: string) {
  return useQuery<boolean, Error>({
    queryKey: ["isUserInGame", gameId.toString(), user],
    queryFn: () => isUserInGame(gameId, user),
    enabled: !!gameId && !!user,
  });
}

export function usePendingSpin(gameId: bigint) {
  return useQuery<SpinRequest, Error>({
    queryKey: ["pendingSpin", gameId.toString()],
    queryFn: () => getPendingSpin(gameId),
    enabled: !!gameId && gameId > 0n,
    refetchInterval: 2000,
    staleTime: 0,
  });
}

export function useAllGames(page: number = 1, pageSize: number = 10) {
  return useQuery<GameInfo[], Error>({
    queryKey: ["allGames", page],
    queryFn: async () => {
      const totalGames = await getTotalGames();
      // Scan newest → oldest so the most recent games appear first
      const end = totalGames;
      const start = totalGames > BigInt(pageSize) ? totalGames - BigInt(pageSize) + 1n : 1n;
      const games: GameInfo[] = [];
      for (let i = end; i >= start; i--) {
        try {
          const game = await getGameInfo(i);
          games.push(game);
        } catch (error) {
          console.warn(`Skipping game ${i}:`, error);
        }
      }
      return games;
    },
    staleTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useActiveGames(page: number = 1) {
  const { setActiveGames } = useGameStore();
  const queryClient = useQueryClient();
  const query = useQuery<GameInfo[], Error>({
    queryKey: ["activeGames", page],
    queryFn: async () => {
      const totalGames = await getTotalGames();
      // Scan ALL games newest → oldest to never miss a newly created game
      const games: GameInfo[] = [];
      for (let i = totalGames; i >= 1n; i--) {
        try {
          const game = await getGameInfo(i);
          games.push(game);
        } catch (error) {
          console.warn(`Skipping game ${i}:`, error);
        }
      }
      // Update allGames cache as a side-effect
      queryClient.setQueryData(["allGames", page], games);
      return games.filter(
        (g: GameInfo) =>
          g.status === GameStatus.Active || g.status === GameStatus.InProgress
      );
    },
    staleTime: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (query.data) setActiveGames(query.data);
  }, [query.data, setActiveGames]);

  return query;
}

export function useMyGames(): UseQueryResult<GameInfo[], Error> {
  const { address } = useAccount();
  const { addGame } = useGameStore();

  return useQuery<GameInfo[], Error>({
    queryKey: ["myGames", address ?? "invalid"],
    queryFn: async () => {
      if (!address) return [];
      const total = await getTotalGames();
      const gameIds = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
      const games: GameInfo[] = [];
      for (const gameId of gameIds) {
        try {
          const game = await getGameInfo(gameId);
          const lowerAddr = address.toLowerCase();
          const isPlayer = game.players.map((p) => p.toLowerCase()).includes(lowerAddr);
          const isCreator = game.creator.toLowerCase() === lowerAddr;
          if (isPlayer || isCreator) {
            games.push(game);
            addGame(game);
          }
        } catch (error) {
          console.warn(`useMyGames: Skipping game ${gameId}:`, error);
        }
      }
      return games;
    },
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 30_000,
  });
}

export function useGameStatus(gameId?: bigint): UseQueryResult<GameInfo, Error> {
  const { updateGameStatus } = useGameStore();

  const query = useQuery<GameInfo, Error>({
    queryKey: ["gameStatus", gameId?.toString() ?? "invalid"],
    queryFn: () => {
      if (!gameId) throw new Error("Invalid game ID");
      return getGameInfo(gameId);
    },
    refetchInterval: (q) =>
      q.state.data?.status === GameStatus.InProgress ? 5000 : 15000,
    refetchOnWindowFocus: true,
    enabled: !!gameId,
    retry: 2,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data && gameId) {
      updateGameStatus(gameId, query.data.status);
    }
  }, [query.data, gameId, updateGameStatus]);

  return query;
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HOOKS  (wagmi useWriteContract + useWaitForTransactionReceipt)
// ─────────────────────────────────────────────────────────────────────────────

/** Generic hook that wraps wagmi writeContract + waits for receipt */
function useContractWrite() {
  const { writeContractAsync: _write } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const chainId = useChainId();
  const { address } = useAccount();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activeGames"] });
    qc.invalidateQueries({ queryKey: ["myGames"] });
    qc.invalidateQueries({ queryKey: ["gameStatus"] });
    qc.invalidateQueries({ queryKey: ["allGames"] });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writeContractAsync = async (args: any) => {
    if (chainId !== celo.id) {
      await switchChainAsync({ chainId: celo.id });
    }
    const hash = await _write(args);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      // Simulate with the same args (including account) to extract the revert reason
      try {
        await publicClient.simulateContract({ ...args, account: address });
      } catch (simErr: any) {
        throw simErr;
      }
      throw new Error("Transaction reverted on-chain");
    }
    return hash;
  };

  return { writeContractAsync, invalidate };
}

export function useCreateGame() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ duration, stake }: { duration: bigint; stake: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(createGameArgs(duration, stake));
      const receipt = await publicClient.getTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: BREEVS_ABI, logs: receipt.logs, eventName: "GameCreated" });
      const gameId = logs[0]?.args.gameId ?? await getTotalGames();
      invalidate();
      return { txId: hash, gameId };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useJoinGame() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId, stake }: { gameId: bigint; stake?: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(joinGameArgs(gameId, stake));
      invalidate();
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useStartGame() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(startGameArgs(gameId));
      invalidate();
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useRequestSpin() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(requestSpinArgs(gameId));
      invalidate();
      qc.invalidateQueries({ queryKey: ["pendingSpin", gameId.toString()] });
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useResolveSpin() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(resolveSpinArgs(gameId));
      invalidate();
      qc.invalidateQueries({ queryKey: ["pendingSpin", gameId.toString()] });
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useAdvanceRound() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(advanceRoundArgs(gameId));
      invalidate();
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useClaimPrize() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint; user?: string }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(claimPrizeArgs(gameId));
      invalidate();
      qc.invalidateQueries({ queryKey: ["isPrizeClaimed", gameId.toString()] });
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

export function useCancelGame() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(cancelGameArgs(gameId));
      invalidate();
      return { txId: hash };
    } catch (err: any) {
      const mapped = mapContractError(err);
      const e = new Error(mapped.message);
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutateAsync, isPending, error };
}

// Legacy compatibility alias for components that still use useSpin
export const useSpin = useRequestSpin;
