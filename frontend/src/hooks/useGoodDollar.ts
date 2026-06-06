"use client";

import { useReadContract, useAccount } from "wagmi";
import { createWalletClient, custom, maxUint256, parseSignature } from "viem";
import { celo } from "wagmi/chains";
import {
  ERC20_ABI,
  G_TOKEN_ADDRESS,
  G_TOKEN_DECIMALS,
} from "@/config/gooddollar";
import { CONTRACT_ADDRESS, publicClient } from "@/lib/contractCalls";

const PERMIT_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v",        type: "uint8"   },
      { name: "r",        type: "bytes32" },
      { name: "s",        type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function getCeloWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Wallet not available");
  }
  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });
  const currentChainId = await walletClient.getChainId();
  if (currentChainId !== celo.id) {
    await walletClient.switchChain({ id: celo.id });
  }
  const [account] = await walletClient.getAddresses();
  return { walletClient, account };
}

export function useGBalance() {
  const { address } = useAccount();
  return useReadContract({
    address: G_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/**
 * Sign a G$ permit message off-chain, then submit it via the server-side
 * relayer so MetaMask never needs to simulate or send the approve tx.
 * Only ONE MetaMask popup: the off-chain signature.
 */
export async function approveViaPermit(owner: `0x${string}`): Promise<void> {
  const { walletClient, account } = await getCeloWalletClient();

  const nonce = await publicClient.readContract({
    address: G_TOKEN_ADDRESS,
    abi: PERMIT_ABI,
    functionName: "nonces",
    args: [owner],
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

  // Off-chain signature — no transaction, no gas, no relay involved
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: "GoodDollar",
      version: "1",
      chainId: celo.id,
      verifyingContract: G_TOKEN_ADDRESS,
    },
    types: {
      Permit: [
        { name: "owner",    type: "address" },
        { name: "spender",  type: "address" },
        { name: "value",    type: "uint256" },
        { name: "nonce",    type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: { owner, spender: CONTRACT_ADDRESS, value: maxUint256, nonce, deadline },
  });

  const { v, r, s } = parseSignature(signature);

  // Server-side relayer submits permit() — bypasses MetaMask simulation
  const res = await fetch("/api/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner, deadline: deadline.toString(), v: Number(v), r, s }),
  });

  const data = await res.json();
  if (!data.ok) {
    // Surface the real error — don't swallow it or fall back to another popup
    throw new Error(
      data.error?.includes("relay") || data.error?.includes("TIMEOUT")
        ? "G$ network relay is unavailable right now. Please try again in a few minutes."
        : data.error || "G$ approval failed"
    );
  }
}

/**
 * Ensure the game contract has sufficient G$ allowance.
 * Uses permit (one sign popup, no relay exposure). No fallback approve —
 * falling back causes a second MetaMask popup that also fails.
 */
export async function ensureGAllowance(
  owner: `0x${string}`,
  amount: bigint
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: G_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, CONTRACT_ADDRESS],
  });

  if (allowance >= amount) return;

  await approveViaPermit(owner);
}

export { G_TOKEN_ADDRESS, G_TOKEN_DECIMALS };
