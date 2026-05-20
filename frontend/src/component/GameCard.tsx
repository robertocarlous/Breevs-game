"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "@/assets/RR_LOGO_1.png";
import { GameStatus, GameInfo, MIN_STAKE } from "@/lib/contractCalls";
import { formatEther } from "viem";
import { useIsGameCreator } from "@/hooks/useGame";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useAccount } from "wagmi";
import { showErrorToast } from "@/component/Toast";

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

  const isJoinDisabled = address
    ? hasActiveGame(address) && !isUserGame && !isGameCreator
    : false;

  const handleAction = async () => {
    if (!address) {
      showErrorToast("Please connect your wallet to interact", "Wallet Required");
      return;
    }

    const gameIdStr = game.gameId.toString();

    if (isJoinDisabled) {
      const activeGame = getCurrentActiveGame(address);
      if (activeGame) {
        showErrorToast(
          `You are already in an active game (#${activeGame.gameId}). Please complete it first.`,
          "Active Game"
        );
        router.push(`/GameScreen/${activeGame.gameId.toString()}`);
      }
      return;
    }

    if (isGameCreator || isUserGame || game.status !== GameStatus.Active) {
      router.push(`/GameScreen/${gameIdStr}`);
    } else if (game.status === GameStatus.Active && !isUserGame) {
      setSelectedGame(game);
      if (onClick) onClick();
    }
  };

  const shortCreator =
    game.creator && game.creator.startsWith("0x")
      ? `${game.creator.slice(0, 6)}...${game.creator.slice(-4)}`
      : "Unknown";

  const getStatusLabel = () => {
    if (isGameCreator) return "Host";
    switch (game.status) {
      case GameStatus.Active: return "Active";
      case GameStatus.InProgress: return "In Progress";
      case GameStatus.Ended: return "Ended";
      case GameStatus.Cancelled: return "Cancelled";
      default: return "Unknown";
    }
  };

  const getStatusStyles = () => {
    if (isGameCreator) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    switch (game.status) {
      case GameStatus.Active: return "bg-green-500/20 text-green-400 border-green-500/30";
      case GameStatus.InProgress: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case GameStatus.Ended: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case GameStatus.Cancelled: return "bg-red-900/20 text-red-400 border-red-900/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getStatusDot = () => {
    if (isGameCreator) return "bg-amber-400";
    switch (game.status) {
      case GameStatus.Active: return "bg-green-400 animate-pulse";
      case GameStatus.InProgress: return "bg-amber-400 animate-pulse";
      case GameStatus.Ended: return "bg-gray-400";
      case GameStatus.Cancelled: return "bg-red-900";
      default: return "bg-gray-400";
    }
  };

  const stakeDisplay = formatEther(game.stake > 0n ? game.stake : MIN_STAKE);
  const prizeDisplay = formatEther(game.prizePool > 0n ? game.prizePool : game.stake > 0n ? game.stake : MIN_STAKE);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: isJoinDisabled ? 1 : 1.03, y: isJoinDisabled ? 0 : -4 }}
      whileTap={{ scale: isJoinDisabled ? 1 : 0.98 }}
      onClick={handleAction}
      className={`bg-[#1a1a1a] border border-white/10 p-3 sm:p-4 rounded-2xl shadow-xl transition-all duration-300 w-full group relative overflow-hidden ${
        isJoinDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-red-500/30 hover:shadow-red-500/10 hover:shadow-2xl"
      }`}
    >
      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-800/0 group-hover:from-red-500/5 group-hover:to-red-800/5 transition-all duration-300 rounded-2xl pointer-events-none" />

      {isJoinDisabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl pointer-events-none z-10">
          <p className="text-xs text-white/70 text-center px-2">Complete your active game first</p>
        </div>
      )}

      <div className="flex flex-col h-full justify-between gap-3 relative z-10">
        {/* Top row: creator + status */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-widest">Creator</p>
            <p className="text-xs font-semibold text-white font-mono truncate bg-white/5 px-2 py-1 rounded-lg border border-white/10 max-w-[110px]">
              {shortCreator}
            </p>
          </div>
          <div className={`flex-shrink-0 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1.5 border ${getStatusStyles()}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
            <span className="text-[9px] sm:text-xs font-semibold whitespace-nowrap">
              {getStatusLabel()}
            </span>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src={Logo}
            alt="Game Icon"
            className="hidden sm:block w-16 h-auto opacity-80 group-hover:opacity-100 transition-opacity"
          />
        </div>

        {/* Stake display */}
        <div className="text-center py-2 sm:py-3 bg-gradient-to-r from-red-500/10 to-red-800/10 rounded-xl border border-red-500/20 group-hover:border-red-500/40 transition-all duration-300">
          <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-widest">Stake</p>
          <p className="text-lg sm:text-2xl font-bold text-red-500 drop-shadow-lg">
            {stakeDisplay} CELO
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-lg p-2 border border-white/10 group-hover:bg-white/10 transition-all duration-300 text-center">
            <p className="text-[9px] text-gray-500 mb-0.5">Players</p>
            <p className="text-sm sm:text-base font-bold text-white">
              {game.playerCount}<span className="text-gray-500 text-xs">/6</span>
            </p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 border border-white/10 group-hover:bg-white/10 transition-all duration-300 text-center">
            <p className="text-[9px] text-gray-500 mb-0.5">Game ID</p>
            <p className="text-sm sm:text-base font-bold text-white">
              #{game.gameId.toString()}
            </p>
          </div>
        </div>

        {/* Prize Pool */}
        <div className="bg-[#111] border border-amber-500/20 rounded-lg p-2 text-center">
          <p className="text-[9px] text-gray-500 mb-0.5 uppercase tracking-widest">Prize Pool</p>
          <p className="text-sm font-bold text-amber-400">{prizeDisplay} CELO</p>
        </div>

        {error && clearError && (
          <div className="mt-1 p-2 bg-red-900/40 border border-red-500/40 rounded-lg">
            <div className="flex justify-between items-start gap-2">
              <p className="text-xs text-red-300 flex-1">{error}</p>
              <button
                onClick={(e) => { e.stopPropagation(); clearError(); }}
                className="text-red-300 hover:text-red-200 transition-colors text-base leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
