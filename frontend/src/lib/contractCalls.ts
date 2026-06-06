"use client";

import { createPublicClient, http, fallback, parseEther, formatEther, encodeFunctionData, maxUint256 } from "viem";
import { celo } from "wagmi/chains";
import { BREEVS_ABI } from "./BreevsABI";
export { BREEVS_ABI };

// ─── Breevs Contract ─────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export const CONTRACT_NAME = process.env.NEXT_PUBLIC_CONTRACT_NAME || "BreevsRussianRoulette";

// ─── G$ Token (GoodDollar) ───────────────────────────────────────────────────

export const GD_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_GD_TOKEN_ADDRESS || "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A"
) as `0x${string}`;

// G$ on Celo uses 18-decimal representation (same pattern as CELO in the contract)
export const GD_DECIMALS = 18;

/** Canonical Multicall3 on Celo — batches approve + game call into one wallet popup. */
export const MULTICALL3_ADDRESS =
  "0xcA11bde05977b3631167020862e6a7231dbe341" as `0x${string}`;

export const MULTICALL3_ABI = [
  {
    name: "aggregate",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "blockNumber", type: "uint256" },
      { name: "returnData", type: "bytes[]" },
    ],
  },
] as const;

// ─── GoodDollar Protocol Contracts (Identity + UBI Claim) ────────────────────

export const GD_IDENTITY_ADDRESS = (
  process.env.NEXT_PUBLIC_GD_IDENTITY_ADDRESS || ""
) as `0x${string}` | "";

export const GD_UBISCHEME_ADDRESS = (
  process.env.NEXT_PUBLIC_GD_UBISCHEME_ADDRESS || ""
) as `0x${string}` | "";

// ─── ERC-20 ABI (subset: balance, allowance, approve) ────────────────────────

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── GoodDollar Identity ABI ─────────────────────────────────────────────────

export const GD_IDENTITY_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isWhitelisted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── GoodDollar UBIScheme ABI ─────────────────────────────────────────────────

export const GD_UBISCHEME_ABI = [
  {
    inputs: [],
    name: "claim",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "checkEntitlement",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Stake Config ─────────────────────────────────────────────────────────────

// Contract uses 1e18 as minimum (18-decimal representation, same pattern as CELO)
export const MIN_STAKE = parseEther("1");    // 1 G$
export const MAX_STAKE = parseEther("1000"); // 1000 G$

export const STAKE_OPTIONS = [
  { label: "1",   value: parseEther("1"),   prize: "6" },
  { label: "5",   value: parseEther("5"),   prize: "30" },
  { label: "10",  value: parseEther("10"),  prize: "60" },
  { label: "50",  value: parseEther("50"),  prize: "300" },
  { label: "100", value: parseEther("100"), prize: "600" },
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
  Cancelled = 3,  // CANCELLED
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
  const playerCount = activePlayers !== null ? activePlayers.length : game.players.length;

  return {
    gameId,
    creator: game.creator,
    stake: game.stake,
    prizePool: game.prizePool,
    players: game.players,
    eliminatedPlayers: activePlayers !== null
      ? game.players.filter((p) => !activePlayers.map((a) => a.toLowerCase()).includes(p.toLowerCase()))
      : [],
    playerCount,
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

export async function isPrizeClaimed(gameId: bigint, _user: string): Promise<boolean> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "prizeClaimed",
    args: [gameId],
  });
  return result as boolean;
}

export async function isUserInGame(gameId: bigint, user: string): Promise<boolean> {
  const game = await getGameInfo(gameId);
  return game.players.map((a) => a.toLowerCase()).includes(user.toLowerCase());
}

export async function isGameCreator(gameId: bigint, user: string): Promise<boolean> {
  const game = await getGameInfo(gameId);
  return game.creator.toLowerCase() === user.toLowerCase();
}

export async function getActivePlayers(gameId: bigint): Promise<string[]> {
  const result = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "getActivePlayers",
    args: [gameId],
  });
  return result as string[];
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

// ─── G$ Token READ FUNCTIONS ─────────────────────────────────────────────────

export async function getGDBalance(address: string): Promise<bigint> {
  const result = await publicClient.readContract({
    address: GD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  return result as bigint;
}

export async function getGDAllowance(owner: string): Promise<bigint> {
  const result = await publicClient.readContract({
    address: GD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as `0x${string}`, CONTRACT_ADDRESS],
  });
  return result as bigint;
}

// ─── GoodDollar Identity + Claim READ ────────────────────────────────────────

export async function getGDIdentityStatus(address: string): Promise<boolean> {
  if (!GD_IDENTITY_ADDRESS) return false;
  const result = await publicClient.readContract({
    address: GD_IDENTITY_ADDRESS as `0x${string}`,
    abi: GD_IDENTITY_ABI,
    functionName: "isWhitelisted",
    args: [address as `0x${string}`],
  });
  return result as boolean;
}

export async function getGDClaimEntitlement(address: string): Promise<bigint> {
  if (!GD_UBISCHEME_ADDRESS) return 0n;
  const result = await publicClient.readContract({
    address: GD_UBISCHEME_ADDRESS as `0x${string}`,
    abi: GD_UBISCHEME_ABI,
    functionName: "checkEntitlement",
    args: [address as `0x${string}`],
  });
  return result as bigint;
}

// ─── WRITE FUNCTION ARG BUILDERS ─────────────────────────────────────────────

function gdApproveCalldata(): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CONTRACT_ADDRESS, maxUint256],
  });
}

/** One tx: max-approve G$ + createGame (single wallet popup). */
export function createGameWithApprovalArgs(roundDuration: bigint, stake: bigint = MIN_STAKE) {
  return {
    address: MULTICALL3_ADDRESS,
    abi: MULTICALL3_ABI,
    functionName: "aggregate" as const,
    args: [
      [
        { target: GD_TOKEN_ADDRESS, callData: gdApproveCalldata() },
        {
          target: CONTRACT_ADDRESS,
          callData: encodeFunctionData({
            abi: BREEVS_ABI,
            functionName: "createGame",
            args: [stake, roundDuration],
          }),
        },
      ],
    ] as const,
    chain: celo,
  };
}

/** One tx: max-approve G$ + joinGame (single wallet popup). */
export function joinGameWithApprovalArgs(gameId: bigint) {
  return {
    address: MULTICALL3_ADDRESS,
    abi: MULTICALL3_ABI,
    functionName: "aggregate" as const,
    args: [
      [
        { target: GD_TOKEN_ADDRESS, callData: gdApproveCalldata() },
        {
          target: CONTRACT_ADDRESS,
          callData: encodeFunctionData({
            abi: BREEVS_ABI,
            functionName: "joinGame",
            args: [gameId],
          }),
        },
      ],
    ] as const,
    chain: celo,
  };
}

export function approveGDArgs(amount: bigint = maxUint256) {
  return {
    address: GD_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve" as const,
    // Approve max once — avoids repeated relay calls for every game
    args: [CONTRACT_ADDRESS, maxUint256] as const,
    chain: celo,
    gas: 200000n,
  };
}

export function createGameArgs(roundDuration: bigint, stake: bigint = MIN_STAKE) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "createGame" as const,
    args: [stake, roundDuration] as const,
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

export function joinGameArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "joinGame" as const,
    args: [gameId] as const,
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

export function spinRoundArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "spinRound" as const,
    args: [gameId] as const,
    gas: 400000n,
  };
}

export function advanceRoundArgs(gameId: bigint) {
  return {
    address: CONTRACT_ADDRESS,
    abi: BREEVS_ABI,
    functionName: "advanceRound" as const,
    args: [gameId] as const,
    gas: 150000n,
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

export function claimGDArgs() {
  return {
    address: GD_UBISCHEME_ADDRESS as `0x${string}`,
    abi: GD_UBISCHEME_ABI,
    functionName: "claim" as const,
    args: [] as const,
    chain: celo,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatGD(amount: bigint): string {
  return `${parseFloat(formatEther(amount)).toFixed(2)} G$`;
}

// Alias kept for backward compat
export const formatCelo = formatGD;

export function mapContractError(error: unknown): { message: string } {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("ERC20InsufficientAllowance") || msg.includes("allowance")) return { message: "Insufficient G$ allowance — please approve first" };
    if (msg.includes("ERC20InsufficientBalance") || msg.includes("insufficient balance")) return { message: "Insufficient G$ balance" };
    if (msg.includes("Stake must be")) return { message: "Stake must be between 1 and 1000 G$" };
    if (msg.includes("Game not joinable")) return { message: "This game is not open for joining" };
    if (msg.includes("Game is full")) return { message: "Game is full (6 players max)" };
    if (msg.includes("Already in game")) return { message: "You are already in this game" };
    if (msg.includes("Only creator can start")) return { message: "Only the game creator can start" };
    if (msg.includes("Need exactly 6 players")) return { message: "Need exactly 6 players to start" };
    if (msg.includes("Only one player left")) return { message: "Only one player left – game should be ending" };
    if (msg.includes("Must wait for RANDAO reveal")) return { message: "Please wait 1 block before resolving the spin" };
    if (msg.includes("Spin request expired")) return { message: "Spin expired – request a new spin" };
    if (msg.includes("No pending spin")) return { message: "No pending spin to resolve" };
    if (msg.includes("User rejected") || msg.includes("user rejected")) return { message: "Transaction rejected by user" };
    if (msg.includes("Invalid duration")) return { message: "Invalid round duration" };
    if (msg.includes("Host wallet must hold")) return { message: "Host wallet must hold at least 5× the stake in G$" };
    return { message: msg };
  }
  return { message: String(error) };
}
