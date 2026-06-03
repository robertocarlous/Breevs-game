"use client";

import { useAccount } from "wagmi";
import { useState, useCallback } from "react";
import { G_TOKEN_SYMBOL } from "@/config/gooddollar";

/**
 * In-app UBI claim using @goodsdks/citizen-sdk (GoodBuilders: claim + identity integration).
 * @see https://docs.gooddollar.org/for-developers/apis-and-sdks/ubi/claim-ubi-viem-wagmi
 */
export default function GoodDollarClaimPanel() {
  const { address, isConnected } = useAccount();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runClaimFlow = useCallback(async () => {
    if (!address || !window.ethereum) return;
    setLoading(true);
    setMessage(null);
    try {
      const { ClaimSDK, IdentitySDK } = await import("@goodsdks/citizen-sdk");

      const identity = await IdentitySDK.init(window.ethereum, "production");
      const { isWhitelisted } = await identity.getWhitelistedRoot(
        address as `0x${string}`
      );

      if (!isWhitelisted) {
        const link = await identity.generateFVLink(
          true,
          typeof window !== "undefined" ? window.location.href : undefined,
          42220
        );
        setMessage(
          "Complete face verification first, then return here to claim."
        );
        window.open(link, "_blank", "noopener,noreferrer");
        return;
      }

      const claimSdk = await ClaimSDK.init(window.ethereum, "production", identity);
      const entitlement = await claimSdk.checkEntitlement();

      if (entitlement === 0n) {
        const next = await claimSdk.nextClaimTime();
        setMessage(
          next
            ? `Already claimed today. Next claim: ${next.toLocaleString()}`
            : "Not eligible to claim right now."
        );
        return;
      }

      await claimSdk.claim();
      setMessage(
        `Claim submitted — ${G_TOKEN_SYMBOL} will arrive in your wallet shortly.`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Claim failed. Try GoodDapp.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [address]);

  if (!isConnected) {
    return (
      <p className="text-xs text-gray-400 text-center">
        Connect wallet to claim daily {G_TOKEN_SYMBOL}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-emerald-300">Claim daily G$</p>
        <p className="text-[11px] text-gray-400 mt-1">
          Get UBI in-app, then stake G$ to play Breevs. Powered by GoodDollar.
        </p>
      </div>
      <button
        type="button"
        onClick={runClaimFlow}
        disabled={loading}
        className="w-full py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Checking…" : `Claim ${G_TOKEN_SYMBOL}`}
      </button>
      {message && (
        <p className="text-xs text-gray-300 leading-relaxed">{message}</p>
      )}
      <a
        href="https://gooddapp.org"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-[10px] text-emerald-400/80 hover:underline"
      >
        Open GoodDapp →
      </a>
    </div>
  );
}
