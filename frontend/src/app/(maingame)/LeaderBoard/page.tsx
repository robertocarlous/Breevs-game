"use client";

import React, { useEffect, useState } from "react";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import { motion, AnimatePresence } from "framer-motion";
import { getUserStats, getAllGameIds, getGameInfo } from "@/lib/contractCalls";
import { Open_Sans } from "next/font/google";
import { formatEther } from "viem";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

interface PlayerStats {
  address: string;
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: bigint;
  totalStaked: bigint;
  winPercentage: number;
  image?: string;
}

const PlayersList: React.FC = () => {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get all game IDs
      const gameIds = await getAllGameIds();
      const uniquePlayersMap = new Map<string, PlayerStats>();

      // Collect all unique players from all games
      for (const gameId of gameIds) {
        try {
          const gameInfo = await getGameInfo(gameId);

          // Add all players from this game
          for (const playerAddress of gameInfo.players) {
            if (!uniquePlayersMap.has(playerAddress)) {
              // Fetch user stats from contract
              const stats = await getUserStats(playerAddress);

              const winPercentage =
                stats.gamesPlayed > 0
                  ? (stats.gamesWon / stats.gamesPlayed) * 100
                  : 0;

              uniquePlayersMap.set(playerAddress, {
                address: playerAddress,
                gamesPlayed: stats.gamesPlayed,
                gamesWon: stats.gamesWon,
                totalWinnings: stats.totalWinnings,
                totalStaked: stats.totalStaked,
                winPercentage,
                image: `/images/player-${playerAddress.slice(-4)}.jpg`,
              });
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch game ${gameId}:`, err);
        }
      }

      const rankedPlayers = Array.from(uniquePlayersMap.values()).sort(
        (a, b) => {
          if (b.winPercentage !== a.winPercentage) {
            return b.winPercentage - a.winPercentage;
          }
          return Number(b.totalWinnings - a.totalWinnings);
        }
      );

      setPlayers(rankedPlayers);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      setError("Failed to load leaderboard. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-orange-400";
    return "text-white";
  };

  const formatCelo = (amount: bigint) => {
    return parseFloat(formatEther(amount)).toFixed(2);
  };

  if (isLoading) {
    return (
      <BackgroundImgBlur>
        <div
          className={`${openSans.className} w-full min-h-screen flex flex-col items-center p-4 sm:p-8 lg:p-16`}
        >
          {/* Header */}
          <div className="w-full max-w-6xl bg-gradient-to-r from-[#030b1f] via-[#0a1529] to-[#030b1f] border-b border-red-500/20 rounded-t-2xl p-6 sticky top-0 z-50 backdrop-blur-md">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center">
              <span className="text-white">Best Players </span>
              <span className="text-[#FF3B3B]">Rankings</span>
            </h1>
            <p className="text-sm text-gray-400 text-center mt-2">
              Top performers across all games
            </p>
          </div>

          {/* Loading State */}
          <div className="w-full max-w-6xl flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-4"></div>
              <p className="text-white text-lg">Loading leaderboard...</p>
            </div>
          </div>
        </div>
      </BackgroundImgBlur>
    );
  }

  if (error) {
    return (
      <BackgroundImgBlur>
        <div
          className={`${openSans.className} w-full min-h-screen flex flex-col items-center justify-center p-4`}
        >
          <div className="bg-gradient-to-br from-[#030b1f]/90 to-[#0a1529]/90 backdrop-blur-md rounded-2xl border border-red-500/20 p-8 max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 text-center">
              Error
            </h3>
            <p className="text-gray-400 text-center mb-4">{error}</p>
            <button
              onClick={fetchLeaderboard}
              className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </BackgroundImgBlur>
    );
  }

  if (players.length === 0) {
    return (
      <BackgroundImgBlur>
        <div
          className={`${openSans.className} w-full min-h-screen flex flex-col items-center p-4 sm:p-8 lg:p-16`}
        >
          {/* Header */}
          <div className="w-full max-w-6xl bg-gradient-to-r from-[#030b1f] via-[#0a1529] to-[#030b1f] border-b border-red-500/20 rounded-t-2xl p-6 sticky top-0 z-50 backdrop-blur-md">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center">
              <span className="text-white">Best Players </span>
              <span className="text-[#FF3B3B]">Rankings</span>
            </h1>
          </div>

          {/* Empty State */}
          <div className="w-full max-w-6xl flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-gray-500"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                No Players Yet
              </h3>
              <p className="text-gray-400">Be the first to join a game!</p>
            </div>
          </div>
        </div>
      </BackgroundImgBlur>
    );
  }

  return (
    <BackgroundImgBlur>
      <div
        className={`${openSans.className} w-full min-h-screen flex flex-col items-center p-4 sm:p-8 lg:p-16`}
      >
        {/* Sticky Header */}
        <div className="w-full max-w-6xl bg-gradient-to-r from-[#030b1f] via-[#0a1529] to-[#030b1f] border-b border-red-500/20 rounded-t-2xl p-6 sticky top-0 z-50 backdrop-blur-md shadow-xl">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center">
            <span className="text-white">Best Players </span>
            <span className="text-[#FF3B3B]">Rankings</span>
          </h1>
          <p className="text-sm text-gray-400 text-center mt-2">
            Top performers across all games • {players.length} players competing
          </p>
        </div>

        {/* Scrollable Table Container */}
        <div className="w-full max-w-6xl flex-1 overflow-y-auto bg-gradient-to-b from-[#030b1f]/50 to-transparent rounded-b-2xl">
          <div className="p-4 sm:p-6">
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={player.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="mb-4"
                >
                  <div className="bg-gradient-to-br from-[#191F57]/90 to-[#0a1529]/90 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 sm:p-5 hover:border-red-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5 border-2 ${
                          index === 0
                            ? "border-yellow-400"
                            : index === 1
                            ? "border-gray-300"
                            : index === 2
                            ? "border-orange-400"
                            : "border-gray-700"
                        } flex items-center justify-center`}
                      >
                        <span
                          className={`text-lg sm:text-2xl font-bold ${getRankColor(
                            index + 1
                          )}`}
                        >
                          {getRankBadge(index + 1)}
                        </span>
                      </div>

                      {/* Player Avatar */}
                      <div className="flex-shrink-0 hidden sm:flex w-12 h-12 rounded-full border-2 border-red-500/30 bg-gradient-to-br from-red-900/60 to-[#030B1F] items-center justify-center">
                        <span className="text-lg font-bold text-red-400">
                          {player.address.slice(2, 4).toUpperCase()}
                        </span>
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm sm:text-base truncate font-mono">
                          {player.address.slice(0, 8)}...
                          {player.address.slice(-6)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
                            {player.winPercentage.toFixed(1)}% Win Rate
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatCelo(player.totalWinnings)} CELO won
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex-shrink-0 text-right">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white/5 rounded-lg p-2 min-w-[60px]">
                            <p className="text-gray-400">Played</p>
                            <p className="text-white font-bold text-sm">
                              {player.gamesPlayed}
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-2 min-w-[60px]">
                            <p className="text-gray-400">Wins</p>
                            <p className="text-green-400 font-bold text-sm">
                              {player.gamesWon}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="w-full max-w-6xl mt-4 mb-10 md:mb-20 lg:mb-0">
          <button
            onClick={fetchLeaderboard}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh Leaderboard
          </button>
        </div>
      </div>
    </BackgroundImgBlur>
  );
};

export default PlayersList;
