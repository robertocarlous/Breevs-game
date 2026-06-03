"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { CheckCircle, XCircle, Coins, ExternalLink, Loader2 } from "lucide-react";
import {
  useGDBalance,
  useGDIdentity,
  useGDClaimEntitlement,
  useClaimGD,
} from "@/hooks/useGame";
import { GD_IDENTITY_ADDRESS, GD_UBISCHEME_ADDRESS } from "@/lib/contractCalls";

export default function GoodDollarPanel() {
  const { address } = useAccount();
  const [claimSuccess, setClaimSuccess] = useState(false);

  const { data: gdBalance = 0n }      = useGDBalance(address);
  const { data: isVerified }          = useGDIdentity(address);
  const { data: claimable = 0n }      = useGDClaimEntitlement(address);
  const { mutateAsync: claimGD, isPending: claiming, error: claimError } = useClaimGD();

  const balanceDisplay  = parseFloat(formatEther(gdBalance)).toFixed(2);
  const claimableDisplay = parseFloat(formatEther(claimable)).toFixed(2);
  const hasClaimable    = claimable > 0n;
  const identityKnown   = !!GD_IDENTITY_ADDRESS;
  const claimKnown      = !!GD_UBISCHEME_ADDRESS;

  const handleClaim = async () => {
    try {
      await claimGD();
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 4000);
    } catch {
      // error shown via claimError
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/5 overflow-hidden"
      style={{ background: "linear-gradient(160deg,#001a0a 0%,#000d05 100%)" }}
    >
      {/* Header */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-green-700/40 to-transparent" />
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-green-400" />
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">GoodDollar (G$)</p>
        </div>
        <a
          href="https://wallet.gooddollar.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-400 transition-colors"
        >
          GoodDollar <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="p-4 space-y-4">

        {/* G$ Balance */}
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">G$ Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{balanceDisplay}</span>
            <span className="text-base font-bold text-green-500">G$</span>
          </div>
        </div>

        {/* Identity Status */}
        {identityKnown && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            {isVerified === undefined ? (
              <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
            ) : isVerified ? (
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-orange-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-300">
                {isVerified === undefined
                  ? "Checking identity…"
                  : isVerified
                  ? "Identity Verified"
                  : "Not Verified Yet"}
              </p>
              {isVerified === false && (
                <p className="text-[10px] text-gray-600 mt-0.5">
                  Verify your face to earn daily G$
                </p>
              )}
            </div>
            {isVerified === false && (
              <a
                href="https://wallet.gooddollar.org/signin"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] font-bold text-orange-400 hover:text-orange-300 transition-colors border border-orange-700/40 rounded-lg px-2 py-1"
              >
                Verify
              </a>
            )}
          </div>
        )}

        {/* Claim UBI */}
        {claimKnown ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">Daily UBI</p>
              {hasClaimable && (
                <span className="text-[10px] font-bold text-green-400">
                  {claimableDisplay} G$ available
                </span>
              )}
            </div>

            {claimSuccess ? (
              <div className="flex items-center gap-2 text-green-400 text-xs font-bold py-2">
                <CheckCircle className="w-4 h-4" />
                Claimed successfully!
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming || !hasClaimable}
                className={`w-full py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  hasClaimable && !claiming
                    ? "bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/30"
                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                }`}
              >
                {claiming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Claiming…
                  </>
                ) : hasClaimable ? (
                  `Claim ${claimableDisplay} G$`
                ) : (
                  "No G$ to claim yet"
                )}
              </button>
            )}

            {claimError && (
              <p className="text-[10px] text-red-400">{claimError.message}</p>
            )}
          </div>
        ) : (
          /* Fallback: link to GoodDollar app if UBIScheme not configured */
          <a
            href="https://wallet.gooddollar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800/30 transition-all"
          >
            Claim G$ on GoodDollar <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Info footer */}
        <p className="text-[9px] text-gray-700 text-center leading-relaxed">
          G$ is GoodDollar's Universal Basic Income token. Verified members earn free G$ daily.
        </p>
      </div>
    </motion.div>
  );
}
