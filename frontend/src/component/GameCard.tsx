"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { GameStatus, GameInfo, MIN_STAKE } from "@/lib/contractCalls";
import { formatEther } from "viem";
import { useIsGameCreator } from "@/hooks/useGame";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useAccount } from "wagmi";
import { showErrorToast } from "@/component/Toast";
import Mascot from "@/assets/RR_LOGO_1.png";
import RRLogo from "@/assets/RR_LOGO_2_1.png";

interface GameCardProps {
  game: GameInfo;
  error?: string;
  clearError?: () => void;
  onClick?: () => void;
}

export default function GameCard({ game, error, clearError, onClick }: GameCardProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { hasActiveGame, getCurrentActiveGame, setSelectedGame } = useGameStore();
  const { data: isGameCreator } = useIsGameCreator(
    address ? game.gameId : 0n,
    address || ""
  );

  const isUserGame = address
    ? game.players.map((p) => p.toLowerCase()).includes(address.toLowerCase())
    : false;

  const isEnded     = game.status === GameStatus.Ended;
  const isCancelled = game.status === GameStatus.Cancelled;
  const isInactive  = isEnded || isCancelled;

  const isJoinDisabled = address
    ? hasActiveGame(address) && !isUserGame && !isGameCreator && !isInactive
    : false;

  const handleAction = async () => {
    if (!address) {
      showErrorToast("Please connect your wallet to interact", "Wallet Required");
      return;
    }
    if (isJoinDisabled) {
      const activeGame = getCurrentActiveGame(address);
      if (activeGame) {
        showErrorToast(
          `You are already in game #${activeGame.gameId}. Finish it first.`,
          "Active Game"
        );
        router.push(`/GameScreen/${activeGame.gameId.toString()}`);
      }
      return;
    }
    if (isGameCreator || isUserGame || game.status !== GameStatus.Active) {
      router.push(`/GameScreen/${game.gameId.toString()}`);
    } else {
      setSelectedGame(game);
      if (onClick) onClick();
    }
  };

  const shortAddr = (a: string) =>
    a?.startsWith("0x") ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Unknown";

  const stakeEth  = formatEther(game.stake > 0n ? game.stake : MIN_STAKE);
  const prizeEth  = formatEther(game.prizePool > 0n ? game.prizePool : game.stake > 0n ? game.stake : MIN_STAKE);
  const shortWinner = game.winner?.startsWith("0x") ? shortAddr(game.winner) : null;

  /* ─── Per-status visual theme ───────────────────────────────── */
  const T = (() => {
    if (isCancelled) return {
      wrap:       "border-[#2a0a0a] hover:border-[#4a1010] bg-[#0c0404]",
      topBar:     "via-red-900/40",
      badge:      "text-red-500/80 border-red-900/50 bg-red-950/30",
      dot:        "bg-red-800",
      label:      "Cancelled",
      priceColor: "text-gray-500",
      note:       "Stake refunded",
      cta:        "bg-white/5 hover:bg-white/8 text-gray-500",
      ctaText:    "View",
      mascotOpacity: "opacity-10 grayscale",
      logoOpacity:   "opacity-30 grayscale",
    };
    if (isEnded) return {
      wrap:       "border-[#0f2a4a] hover:border-[#1a4070] bg-gradient-to-b from-[#060f1e] to-[#030810]",
      topBar:     "via-sky-500/50",
      badge:      "text-sky-400 border-sky-700/40 bg-sky-950/40",
      dot:        "bg-sky-400",
      label:      "Ended",
      priceColor: "text-white",
      note:       "CELO",
      cta:        "bg-sky-900/30 hover:bg-sky-800/40 text-sky-300",
      ctaText:    "View Result",
      mascotOpacity: "opacity-20",
      logoOpacity:   "opacity-60",
    };
    if (game.status === GameStatus.InProgress) return {
      wrap:       "border-orange-900/40 hover:border-orange-600/50 bg-gradient-to-b from-[#100900] to-[#050200]",
      topBar:     "via-orange-500/60",
      badge:      isGameCreator ? "text-amber-300 border-amber-600/40 bg-amber-950/30" : "text-orange-300 border-orange-700/40 bg-orange-950/30",
      dot:        "bg-orange-400 animate-pulse",
      label:      isGameCreator ? "Your Game" : "In Progress",
      priceColor: "text-orange-300",
      note:       "CELO",
      cta:        "bg-orange-700/20 hover:bg-orange-600/30 text-orange-300",
      ctaText:    isGameCreator ? "Manage" : isUserGame ? "Rejoin" : "Watch",
      mascotOpacity: "opacity-15",
      logoOpacity:   "opacity-50",
    };
    // Active
    return {
      wrap:       "border-[#1a0a0a] hover:border-red-600/50 bg-gradient-to-b from-[#0e0404] to-[#030103]",
      topBar:     "via-red-500/70",
      badge:      isGameCreator ? "text-amber-400 border-amber-600/40 bg-amber-950/30"
                                : "text-emerald-400 border-emerald-700/40 bg-emerald-950/30",
      dot:        isGameCreator ? "bg-amber-400" : "bg-emerald-400 animate-pulse",
      label:      isGameCreator ? "HOST 👑" : "OPEN",
      priceColor: "text-red-400",
      note:       "CELO",
      cta:        isGameCreator
        ? "bg-amber-600/20 hover:bg-amber-500/30 text-amber-300"
        : isUserGame
        ? "bg-blue-700/20 hover:bg-blue-600/30 text-blue-300"
        : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40",
      ctaText:       isGameCreator ? "Manage" : isUserGame ? "Rejoin" : "Join Game",
      mascotOpacity: "opacity-15",
      logoOpacity:   "opacity-50",
    };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: isJoinDisabled ? 0 : -4 }}
      whileTap={{ scale: isJoinDisabled ? 1 : 0.98 }}
      onClick={handleAction}
      className={`relative group rounded-2xl border overflow-hidden cursor-pointer transition-colors duration-300 ${T.wrap} ${isJoinDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {/* ── Top accent line ── */}
      <div className={`h-px w-full bg-gradient-to-r from-transparent ${T.topBar} to-transparent`} />

      {/* ── Mascot watermark (large, bottom-right) ── */}
      <div className={`absolute -bottom-3 -right-3 w-28 h-28 pointer-events-none select-none transition-opacity duration-300 group-hover:opacity-30 ${T.mascotOpacity}`}>
        <Image src={Mascot} alt="" fill className="object-contain object-bottom-right" />
      </div>

      {/* ── Disabled overlay ── */}
      {isJoinDisabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-[1px]">
          <p className="text-[10px] text-white/50 text-center px-4">Finish your active game first</p>
        </div>
      )}

      <div className="relative z-10 flex flex-col gap-3 p-4">

        {/* Game ID + Status + RR Logo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* RR Logo — small branded mark on every card */}
            <div className={`relative w-10 h-5 shrink-0 transition-opacity duration-300 ${T.logoOpacity}`}>
              <Image src={RRLogo} alt="RR" fill className="object-contain object-left" />
            </div>
            <span className="text-[10px] font-bold font-mono text-gray-600 tracking-widest">
              #{game.gameId.toString()}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold tracking-wider ${T.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${T.dot}`} />
            {T.label}
          </div>
        </div>

        {/* Prize / Result block */}
        <div className="rounded-xl border border-white/5 bg-black/30 px-3 py-3 text-center">
          {isEnded && shortWinner ? (
            <>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">🏆 Last Survivor</p>
              <p className={`text-2xl font-black leading-none ${T.priceColor}`}>{prizeEth}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">CELO taken</p>
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                <span className="text-[10px] text-sky-400 font-mono font-bold">{shortWinner}</span>
              </div>
            </>
          ) : isCancelled ? (
            <>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-1">Cancelled</p>
              <p className="text-xl font-black text-gray-600 leading-none line-through">{stakeEth}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">stake refunded</p>
            </>
          ) : (
            <>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Prize Pool</p>
              <p className={`text-2xl font-black leading-none ${T.priceColor}`}>{prizeEth}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{T.note}</p>
            </>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "Stake", value: stakeEth },
            { label: "Players", value: `${game.playerCount}/6` },
            { label: "Round", value: game.currentRound > 0 ? String(game.currentRound) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2 text-center">
              <p className="text-[8px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-xs font-bold text-gray-300">{value}</p>
            </div>
          ))}
        </div>

        {/* Creator */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-[8px] font-bold text-gray-400 shrink-0">
            {shortAddr(game.creator).slice(2, 4).toUpperCase()}
          </div>
          <p className="text-[9px] text-gray-600 font-mono truncate">{shortAddr(game.creator)}</p>
        </div>

        {/* CTA */}
        <button
          className={`w-full py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-200 ${T.cta}`}
          onClick={(e) => { e.stopPropagation(); handleAction(); }}
        >
          {T.ctaText}
        </button>

        {/* Error */}
        {error && clearError && (
          <div className="p-2 bg-red-950/50 border border-red-800/30 rounded-lg flex gap-2 items-start">
            <p className="text-xs text-red-400 flex-1">{error}</p>
            <button onClick={(e) => { e.stopPropagation(); clearError(); }} className="text-red-500 hover:text-white">×</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
