"use client";

import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { useWriteContract, useAccount, useSwitchChain, useChainId } from "wagmi";
import { celo } from "wagmi/chains";
import { parseEventLogs } from "viem";
import { useState, useEffect } from "react";
import {
  publicClient,
  BREEVS_ABI,
  ERC20_ABI,
  GD_TOKEN_ADDRESS,
  GD_IDENTITY_ADDRESS,
  GD_UBISCHEME_ADDRESS,
  getGameInfo,
  getPlayerData,
  getUserStats,
  getTotalGames,
  isPrizeClaimed,
  isUserInGame,
  isGameCreator,
  getGDBalance,
  getGDAllowance,
  getGDIdentityStatus,
  getGDClaimEntitlement,
  approveGDArgs,
  createGameArgs,
  cancelGameArgs,
  joinGameArgs,
  startGameArgs,
  spinRoundArgs,
  advanceRoundArgs,
  claimPrizeArgs,
  claimGDArgs,
  CONTRACT_ADDRESS,
  mapContractError,
  GameStatus,
  GameInfo,
  PlayerData,
  UserStats,
} from "@/lib/contractCalls";
import { useGameStore } from "@/store/gameStore";

// ─── Re-export types ──────────────────────────────────────────────────────────
export { GameStatus };
export type { GameInfo, PlayerData, UserStats };

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

export function useAllGames(page: number = 1, pageSize: number = 10) {
  return useQuery<GameInfo[], Error>({
    queryKey: ["allGames", page],
    queryFn: async () => {
      const totalGames = await getTotalGames();
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
      const games: GameInfo[] = [];
      for (let i = totalGames; i >= 1n; i--) {
        try {
          const game = await getGameInfo(i);
          games.push(game);
        } catch (error) {
          console.warn(`Skipping game ${i}:`, error);
        }
      }
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

// ─── G$ Token READ HOOKS ──────────────────────────────────────────────────────

export function useGDBalance(address?: string) {
  return useQuery<bigint, Error>({
    queryKey: ["gdBalance", address],
    queryFn: () => getGDBalance(address!),
    enabled: !!address,
    refetchInterval: 15000,
  });
}

export function useGDAllowance(owner?: string) {
  return useQuery<bigint, Error>({
    queryKey: ["gdAllowance", owner],
    queryFn: () => getGDAllowance(owner!),
    enabled: !!owner,
    refetchInterval: 10000,
  });
}

// ─── GoodDollar Identity + Claim READ HOOKS ───────────────────────────────────

export function useGDIdentity(address?: string) {
  return useQuery<boolean, Error>({
    queryKey: ["gdIdentity", address],
    queryFn: () => getGDIdentityStatus(address!),
    enabled: !!address && !!GD_IDENTITY_ADDRESS,
    staleTime: 60_000,
  });
}

export function useGDClaimEntitlement(address?: string) {
  return useQuery<bigint, Error>({
    queryKey: ["gdClaimEntitlement", address],
    queryFn: () => getGDClaimEntitlement(address!),
    enabled: !!address && !!GD_UBISCHEME_ADDRESS,
    refetchInterval: 30000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WRITE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

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
      try {
        await publicClient.simulateContract({ ...args, account: address });
      } catch (simErr: unknown) {
        throw simErr;
      }
      throw new Error("Transaction reverted on-chain");
    }
    return hash;
  };

  return { writeContractAsync, invalidate, address };
}

/** Checks current G$ allowance and approves if needed before a game action. */
async function ensureGDApproval(
  writeContractAsync: ReturnType<typeof useContractWrite>["writeContractAsync"],
  owner: string,
  amount: bigint
) {
  const allowance = await publicClient.readContract({
    address: GD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as `0x${string}`, CONTRACT_ADDRESS],
  }) as bigint;

  if (allowance < amount) {
    await writeContractAsync(approveGDArgs(amount));
    // Invalidate allowance cache
  }
}

export function useCreateGame() {
  const { writeContractAsync, invalidate, address } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ duration, stake }: { duration: bigint; stake: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      await ensureGDApproval(writeContractAsync, address!, stake);
      const hash = await writeContractAsync(createGameArgs(duration, stake));
      const receipt = await publicClient.getTransactionReceipt({ hash });
      const logs = parseEventLogs({ abi: BREEVS_ABI, logs: receipt.logs, eventName: "GameCreated" });
      const gameId = logs[0]?.args.gameId ?? await getTotalGames();
      invalidate();
      qc.invalidateQueries({ queryKey: ["gdBalance", address] });
      qc.invalidateQueries({ queryKey: ["gdAllowance", address] });
      return { txId: hash, gameId };
    } catch (err: unknown) {
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
  const { writeContractAsync, invalidate, address } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId, stake }: { gameId: bigint; stake?: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      // Fetch the game's stake if not provided
      const stakeAmount = stake ?? (await getGameInfo(gameId)).stake;
      await ensureGDApproval(writeContractAsync, address!, stakeAmount);
      const hash = await writeContractAsync(joinGameArgs(gameId));
      invalidate();
      qc.invalidateQueries({ queryKey: ["gdBalance", address] });
      qc.invalidateQueries({ queryKey: ["gdAllowance", address] });
      return { txId: hash };
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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

export function useSpinRound() {
  const { writeContractAsync, invalidate } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async ({ gameId }: { gameId: bigint }) => {
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(spinRoundArgs(gameId));
      invalidate();
      qc.invalidateQueries({ queryKey: ["gameInfo", gameId.toString()] });
      return { txId: hash };
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
  const { writeContractAsync, invalidate, address } = useContractWrite();
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
      qc.invalidateQueries({ queryKey: ["gdBalance", address] });
      return { txId: hash };
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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

export function useClaimGD() {
  const { writeContractAsync, address } = useContractWrite();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async () => {
    if (!GD_UBISCHEME_ADDRESS) throw new Error("UBIScheme address not configured");
    setIsPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync(claimGDArgs());
      qc.invalidateQueries({ queryKey: ["gdBalance", address] });
      qc.invalidateQueries({ queryKey: ["gdClaimEntitlement", address] });
      return { txId: hash };
    } catch (err: unknown) {
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

export const useSpin = useSpinRound;
