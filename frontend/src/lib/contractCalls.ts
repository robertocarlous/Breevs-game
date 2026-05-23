"use client";

import { createPublicClient, http, fallback, parseEther, formatEther } from "viem";
import { celo } from "wagmi/chains";
import { BREEVS_ABI } from "./BreevsABI";
export { BREEVS_ABI };

// ─── Config ─────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || "BreevsRussianRoulette";

export const MIN_STAKE = parseEther("0.2"); // 0.2 CELO — must match contract MIN_STAKE constant
export const MAX_STAKE = parseEther("5"); // 5 CELO — must match contract MAX_STAKE constant

export const STAKE_OPTIONS = [
  { label: "0.2", value: parseEther("0.2"), prize: "1.2" },
  { label: "0.5", value: parseEther("0.5"), prize: "3" },
  { label: "1", value: parseEther("1"), prize: "6" },
  { label: "2", value: parseEther("2"), prize: "12" },
  { label: "5", value: parseEther("5"), prize: "30" },
] as const;

// ─── Public client for reads ─────────────────────────────────────────────────

const mainnetTransports = [
  "https://forno.celo.org",
  process.env.NEXT_PUBLIC_CELO_RPC_URL,
]
  .filter(Boolean)
  .map((url) => http(url as string));

export const publicClient = createPublicClient({
  chain: celo,
  transport: fallback(mainnetTransports),
});

// ─── Enums / Interfaces ──────────────────────────────────────────────────────

export enum GameStatus {
  Active = 0,     // CREATED
  InProgress = 1, // IN_PROGRESS
  Ended = 2,      // COMPLETED
  Cancelled = 3,  // CANCELLED (creator called cancelGame)
}

export interface GameInfo {
  gameId: bigint;
  creator: string;
  stake: bigint;
  prizePool: bigint;
  players: string[];
  eliminatedPlayers: string[];
  playerCount: number;
  currentRound: number;
  roundEnd: bigint;
  roundDuration: bigint;
  status: GameStatus;
  winner: string | null;
  totalRounds: number;
}

export interface PlayerData {
  eliminated: boolean;
  eliminationRound: number;
  currentRound: number;
  roundEnd: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: bigint;
  totalStaked: bigint;
}

export interface SpinRequest {
  pending: boolean;
  commitBlock: bigint;
  round: bigint;
}

// ─── READ FUNCTIONS ──────────────────────────────────────────────────────────

export async function getTotalGames(): Promise<bigint> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "gameCounter",
  });
  return result as bigint;
}

export async function getGameInfo(gameId: bigint): Promise<GameInfo> {
  // Fetch game struct + active players in parallel
  // getGame().players includes ALL players (never shrinks); getActivePlayers() is the live count
  const [game, activePlayers] = await Promise.all([
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BREEVS_ABI,
      functionName: "getGame",
      args: [gameId],
    }) as Promise<{
      creator: string;
      players: string[];
      stake: bigint;
      prizePool: bigint;
      status: number;
      roundDuration: bigint;
      roundEnd: bigint;
      currentRound: bigint;
      winner: string;
      totalRounds: bigint;
    }>,
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: BREEVS_ABI,
      functionName: "getActivePlayers",
      args: [gameId],
    }).catch(() => null) as Promise<string[] | null>,
  ]);

  const status = Number(game.status) as GameStatus;
  const winnerAddr = game.winner === "0x0000000000000000000000000000000000000000" ? null : game.winner;
  // playerCount = currently active (non-eliminated) players; fall back to total if fetch failed
  const playerCount = activePlayers !== null ? activePlayers.length : game.players.length;

  return {
    gameId,
    creator: game.creator,
    stake: game.stake,
    prizePool: game.prizePool,
    players: game.players,       // full list (all who ever joined) — used to build player registry
    eliminatedPlayers: activePlayers !== null
      ? game.players.filter((p) => !activePlayers.map((a) => a.toLowerCase()).includes(p.toLowerCase()))
      : [],
    playerCount,                 // ← NOW reflects active (non-eliminated) count
    currentRound: Number(game.currentRound),
    roundEnd: game.roundEnd,
    roundDuration: game.roundDuration,
    status,
    winner: winnerAddr,
    totalRounds: Number(game.totalRounds),
  };
}

export async function getPlayerData(
  gameId: bigint,
  player: string
): Promise<PlayerData> {
  const gameInfo = await getGameInfo(gameId);
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "playerGameData",
    args: [gameId, player as `0x${string}`],
  });
  const [eliminated, eliminationRound] = result as [boolean, bigint];
  return {
    eliminated,
    eliminationRound: Number(eliminationRound),
    currentRound: gameInfo.currentRound,
    roundEnd: Number(gameInfo.roundEnd),
  };
}

export async function getUserStats(user: string): Promise<UserStats> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "userStats",
    args: [user as `0x${string}`],
  });
  const [gamesPlayed, gamesWon, totalWinnings, totalStaked] = result as [
    bigint,
    bigint,
    bigint,
    bigint
  ];
  return {
    gamesPlayed: Number(gamesPlayed),
    gamesWon: Number(gamesWon),
    totalWinnings,
    totalStaked,
  };
}

export async function isPrizeClaimed(
  gameId: bigint,
  _user: string
): Promise<boolean> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "prizeClaimed",
    args: [gameId],
  });
  return result as boolean;
}

export async function isUserInGame(
  gameId: bigint,
  user: string
): Promise<boolean> {
  const game = await getGameInfo(gameId);
  return game.players
    .map((a) => a.toLowerCase())
    .includes(user.toLowerCase());
}

export async function isGameCreator(
  gameId: bigint,
  user: string
): Promise<boolean> {
  const game = await getGameInfo(gameId);
  return game.creator.toLowerCase() === user.toLowerCase();
}

/** Returns only non-eliminated (active) player addresses for a game. */
export async function getActivePlayers(gameId: bigint): Promise<string[]> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "getActivePlayers",
    args: [gameId],
  });
  return result as string[];
}

export async function getPendingSpin(gameId: bigint): Promise<SpinRequest> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "getPendingSpin",
    args: [gameId],
  });
  const spin = result as { pending: boolean; commitBlock: bigint; round: bigint };
  return {
    pending: spin.pending,
    commitBlock: spin.commitBlock,
    round: spin.round,
  };
}

export async function getCeloBlockNumber(): Promise<number> {
  const block = await publicClient.getBlockNumber();
  return Number(block);
}

export async function getAllGameIds(): Promise<bigint[]> {
  const counter = await getTotalGames();
  const ids: bigint[] = [];
  for (let i = 1n; i <= counter; i++) ids.push(i);
  return ids;
}

// ─── WRITE FUNCTIONS (wagmi hooks call these via writeContract) ──────────────
// These are used in useGame.ts via wagmi's useWriteContract hook.
// The function bodies below are helper wrappers for non-hook contexts.

export function createGameArgs(roundDuration: bigint, stake: bigint = MIN_STAKE) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "createGame" as const,
    args: [stake, roundDuration] as const,
    value: stake,
    chain: celo,
  };
}

export function cancelGameArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "cancelGame" as const,
    args: [gameId] as const,
  };
}

export function joinGameArgs(gameId: bigint, stake: bigint = MIN_STAKE) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "joinGame" as const,
    args: [gameId] as const,
    value: stake,
  };
}

export function startGameArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "startGame" as const,
    args: [gameId] as const,
  };
}

export function requestSpinArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "requestSpin" as const,
    args: [gameId] as const,
  };
}

export function resolveSpinArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "resolveSpin" as const,
    args: [gameId] as const,
  };
}

export function advanceRoundArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "advanceRound" as const,
    args: [gameId] as const,
  };
}

export function claimPrizeArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "claimPrize" as const,
    args: [gameId] as const,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a wei bigint value to a CELO string (e.g. "1.0 CELO") */
export function formatCelo(wei: bigint): string {
  return `${parseFloat(formatEther(wei)).toFixed(2)} CELO`;
}

export function mapContractError(error: unknown): { message: string } {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Stake must be exactly 1 CELO")) return { message: "Stake must be exactly 1 CELO" };
    if (msg.includes("Must send exactly 1 CELO")) return { message: "Must send exactly 1 CELO as stake" };
    if (msg.includes("Game not joinable")) return { message: "This game is not open for joining" };
    if (msg.includes("Game is full")) return { message: "Game is full (6 players max)" };
    if (msg.includes("Already in game")) return { message: "You are already in this game" };
    if (msg.includes("Only creator can start")) return { message: "Only the game creator can start" };
    if (msg.includes("Need exactly 6 players")) return { message: "Need exactly 6 players to start" };
    if (msg.includes("Only one player left")) return { message: "Only one player left – game should be ending" };
    if (msg.includes("Must wait for RANDAO reveal")) return { message: "Please wait 1 block before resolving the spin" };
    if (msg.includes("Spin request expired")) return { message: "Spin expired – request a new spin" };
    if (msg.includes("No pending spin")) return { message: "No pending spin to resolve" };
    if (msg.includes("User rejected")) return { message: "Transaction rejected by user" };
    if (msg.includes("user rejected")) return { message: "Transaction rejected by user" };
    if (msg.includes("Invalid duration")) return { message: "Invalid round duration" };
    return { message: msg };
  }
  return { message: String(error) };
}
