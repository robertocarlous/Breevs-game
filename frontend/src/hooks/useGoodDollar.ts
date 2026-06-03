"use client";

import { useReadContract } from "wagmi";
import { useAccount } from "wagmi";
import { createWalletClient, custom, maxUint256 } from "viem";
import { celo } from "wagmi/chains";
import {
  ERC20_ABI,
  G_TOKEN_ADDRESS,
  G_TOKEN_DECIMALS,
} from "@/config/gooddollar";
import { CONTRACT_ADDRESS, publicClient } from "@/lib/contractCalls";

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

/** Approve the game contract to spend G$ if allowance is too low. */
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

  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Wallet not available");
  }

  const walletClient = createWalletClient({
    chain: celo,
    transport: custom(window.ethereum),
  });

  const [account] = await walletClient.getAddresses();

  const hash = await walletClient.writeContract({
    address: G_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [CONTRACT_ADDRESS, maxUint256],
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash });
}

export { G_TOKEN_ADDRESS, G_TOKEN_DECIMALS };
