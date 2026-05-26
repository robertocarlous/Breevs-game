"use client";

import { useState, useEffect } from "react";
import { Open_Sans } from "next/font/google";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import Modal from "@/component/ResuableModal";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import GameCard from "@/component/GameCard";
import GameFilter from "@/component/GameFilter";
import CreateGameModal from "@/component/CreateGameModal";
import StakeModal from "@/component/StakeModal";
import { useActiveGames, useMyGames, useGameStatus, useUserStats, useTotalGames } from "@/hooks/useGame";
import { GameStatus, GameInfo } from "@/lib/contractCalls";
import { useGameStore } from "@/store/gameStore";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);

  const {
    activeTab,
    setActiveTab,
    filters,
    setFilters,
    activeGames,
    setActiveGames,
    setMyGames,
    selectedGame,
    setSelectedGame,
  } = useGameStore();

  const { data: fetchedActiveGames = [], isLoading: isLoadingGames } = useActiveGames();
  const { data: fetchedMyGames = [], isLoading: isLoadingMyGames } = useMyGames();

  useEffect(() => {
    if (fetchedActiveGames.length > 0) setActiveGames(fetchedActiveGames);
  }, [fetchedActiveGames, setActiveGames]);

  useEffect(() => {
    if (fetchedMyGames.length > 0) setMyGames(fetchedMyGames);
  }, [fetchedMyGames, setMyGames]);

  const filteredActiveGames = activeGames
    .filter((game) => {
      const stakeInCelo = Number(game.stake) / 1e18;
      const stakeOk = stakeInCelo >= Number(filters.minStake);
      // Show both Active and InProgress games unless a specific status filter is applied
      const statusOk =
        filters.status === GameStatus.Active
          ? game.status === GameStatus.Active || game.status === GameStatus.InProgress
          : game.status === filters.status;
      return stakeOk && statusOk;
    })
    .sort(() => {
      if (filters.sortBy === "newest") return filters.sortOrder === "desc" ? -1 : 1;
      return 0;
    });

  const isFiltersApplied =
    filters.sortBy !== "newest" ||
    filters.sortOrder !== "desc" ||
    filters.minStake !== "0" ||
    filters.status !== GameStatus.Active;

  const handleGameCardClick = (game: GameInfo) => {
    setSelectedGame(game);
    setIsStakeModalOpen(true);
  };

  return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} relative w-full min-h-screen bg-[#030B1F]/60`}>

        {/* Top header */}
        <div className="fixed top-0 z-50 w-full bg-[#030B1F]/90 backdrop-blur-md border-b border-white/5">
          <div className="max-w-screen-xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex-1 text-center">
              <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight">
                Welcome to <span className="text-red-500">Breevs</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 hidden sm:block">
                Russian Roulette on Celo —{" "}
                <span className="text-amber-400 font-semibold">Last survivor wins it all</span>
              </p>
            </div>
            {/* Wallet connect button in header — always visible */}
            <div className="shrink-0">
              <ConnectButton.Custom>
                {({ account, openConnectModal, openAccountModal, mounted }) => {
                  if (!mounted) return null;
                  if (!account) {
                    return (
                      <button
                        onClick={openConnectModal}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-600/20"
                      >
                        Connect
                      </button>
                    );
                  }
                  return (
                    <button
                      onClick={openAccountModal}
                      className="bg-[#0B1445] hover:bg-[#111e5e] border border-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                    >
                      {account.displayName}
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="pt-24 sm:pt-28 w-full max-w-screen-2xl mx-auto px-4 pb-10">

          {/* Modals */}
          <CreateGameModal isOpen={isCreateGameOpen} onClose={() => setIsCreateGameOpen(false)} />
          <StakeModal
            isOpen={isStakeModalOpen}
            onClose={() => { setIsStakeModalOpen(false); setSelectedGame(null); }}
          />

          {/* Filter modal */}
          <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)}>
            <div className="bg-[#030B1F] text-white text-center p-6 rounded-2xl border border-white/10 max-w-sm w-full">
              <h2 className="text-xl font-bold mb-5 text-white">Filter Games</h2>
              <div className="bg-[#0B1445]/80 p-3 rounded-xl mb-4 border border-white/10">
                <GameFilter
                  onFilterChange={(newFilters) => {
                    setFilters({
                      sortBy: newFilters.sortBy,
                      sortOrder: newFilters.sortOrder,
                      minStake: newFilters.minStake ?? "0",
                      status: newFilters.status ?? GameStatus.Active,
                    });
                    setIsFilterOpen(false);
                  }}
                />
              </div>
            </div>
          </Modal>

          {/* ── Two-column dashboard layout ── */}
          <div className="flex gap-5 items-start">

            {/* ── LEFT: Game feed ── */}
            <div className="flex-1 min-w-0">

              {/* Tabs & Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-5">
                <div className="bg-[#0B1445]/80 border border-white/10 rounded-xl p-1 inline-flex shadow-lg">
                  {["active", "my-games"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as "active" | "my-games")}
                      className={`px-5 sm:px-7 py-2 rounded-lg transition-all duration-300 text-sm font-semibold ${
                        activeTab === tab
                          ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {tab === "active" ? "🎮 Active Games" : "🗂 My Games"}
                    </button>
                  ))}
                </div>

                {isConnected && activeTab === "active" && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setIsFilterOpen(true)}
                    className="bg-[#0B1445]/80 border border-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:border-red-500/30 hover:bg-white/5 text-sm font-semibold shadow-lg relative transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    Filter
                    {isFiltersApplied && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </motion.button>
                )}
              </div>

              {/* Game Grids */}
              {!isConnected ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <div className="bg-[#0B1445]/80 border border-white/10 rounded-2xl p-10 max-w-sm mx-auto">
                    <div className="text-4xl mb-4">🎰</div>
                    <h3 className="text-lg font-bold text-white mb-2">Connect to Play</h3>
                    <p className="text-gray-500 text-sm mb-6">
                      Connect your wallet to view and join Russian Roulette games on Celo.
                    </p>
                    <ConnectButton.Custom>
                      {({ openConnectModal, mounted }) => (
                        mounted ? (
                          <button
                            onClick={openConnectModal}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-600/30 text-sm"
                          >
                            🔗 Connect Wallet
                          </button>
                        ) : null
                      )}
                    </ConnectButton.Custom>
                  </div>
                </motion.div>
              ) : isLoadingGames || isLoadingMyGames ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#0B1445]/80 border border-white/5 p-6 rounded-2xl animate-pulse h-52" />
                  ))}
                </div>
              ) : activeTab === "active" ? (
                <ActiveGamesGrid
                  games={filteredActiveGames}
                  setIsCreateGameOpen={setIsCreateGameOpen}
                  onJoinClick={handleGameCardClick}
                />
              ) : (
                <MyGamesGrid address={address!} />
              )}

              {/* Mobile-only: sidebar content stacked below */}
              {isConnected && address && (
                <div className="xl:hidden mt-8 space-y-4">
                  <PlatformStats activeCount={activeGames.length} />
                  <DailyMissions address={address} />
                  <Achievements address={address} />
                </div>
              )}
              {!isConnected && (
                <div className="xl:hidden mt-8">
                  <PlatformStats activeCount={activeGames.length} />
                </div>
              )}
            </div>

            {/* ── RIGHT: Sticky sidebar (desktop only) ── */}
            {isConnected && address ? (
              <aside className="hidden xl:flex flex-col gap-4 w-72 shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none pb-4">
                <PlatformStats activeCount={activeGames.length} />
                <DailyMissions address={address} />
                <Achievements address={address} />
              </aside>
            ) : (
              <aside className="hidden xl:block w-64 shrink-0 sticky top-28 self-start">
                <PlatformStats activeCount={activeGames.length} />
              </aside>
            )}
          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );
}

// ─────────────────────────────────────────────────────────────────
// PLATFORM STATS — compact sidebar card
// ─────────────────────────────────────────────────────────────────
function PlatformStats({ activeCount }: { activeCount: number }) {
  const { data: gameCounter } = useTotalGames();
  const total = Number(gameCounter ?? 0n);

  const stats = [
    { icon: "🎮", label: "Total Games", value: total.toLocaleString() },
    { icon: "🔴", label: "Live Now", value: activeCount > 0 ? `${activeCount} rooms` : "—" },
    { icon: "💀", label: "Max Players", value: "6 / game" },
    { icon: "🏆", label: "Winner Takes", value: "All CELO" },
  ];

  return (
    <div className="bg-[#0B1445]/70 border border-red-500/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <h3 className="text-white font-bold text-xs uppercase tracking-widest">Platform Stats</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[#030B1F]/60 rounded-xl p-2.5 text-center border border-white/5"
          >
            <div className="text-base mb-0.5">{s.icon}</div>
            <p className="text-white font-bold text-sm leading-none">{s.value}</p>
            <p className="text-gray-500 text-[9px] uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DAILY MISSIONS — sidebar card
// ─────────────────────────────────────────────────────────────────
function DailyMissions({ address }: { address: string }) {
  const { data: stats } = useUserStats(address);
  const { myGames } = useGameStore();

  const today = new Date().toDateString();
  const storageKey = `breevs_missions_${address}_${today}`;
  const getCompleted = (): string[] => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  };
  const completed = getCompleted();

  const inActiveGame = myGames.some(
    (g) => g.status === GameStatus.Active || g.status === GameStatus.InProgress
  );
  const inRound3Plus = myGames.some(
    (g) => g.status === GameStatus.InProgress && g.currentRound >= 3
  );
  const wonToday = (stats?.gamesWon ?? 0) > 0;

  const missions = [
    { id: "join",    icon: "🎮", label: "Join or create a game", reward: "🎖️ Contender Badge", done: inActiveGame || completed.includes("join") },
    { id: "survive", icon: "⚔️", label: "Survive into Round 3",  reward: "💀 Survivor Badge",   done: inRound3Plus || completed.includes("survive") },
    { id: "win",     icon: "🏆", label: "Win a game",             reward: "👑 Champion Badge",   done: wonToday || completed.includes("win") },
  ];

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <div className="bg-[#0B1445]/70 border border-white/10 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🎯</span>
        <h3 className="text-white font-bold text-sm">Daily Missions</h3>
        <span className="ml-auto text-[10px] text-gray-500">Resets UTC</span>
      </div>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>{doneCount}/{missions.length} complete</span>
          <span>{Math.round((doneCount / missions.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-600 to-amber-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / missions.length) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
      {/* Mission rows */}
      <div className="space-y-2">
        {missions.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
              m.done
                ? "bg-green-900/20 border-green-500/20"
                : "bg-[#030B1F]/50 border-white/5 hover:border-red-500/20"
            }`}
          >
            <span className="text-xl shrink-0">{m.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold leading-tight truncate ${m.done ? "text-green-300" : "text-white"}`}>
                {m.label}
              </p>
              <p className="text-[10px] text-amber-400 font-bold mt-0.5">{m.reward}</p>
            </div>
            {m.done
              ? <span className="text-green-400 text-base shrink-0">✓</span>
              : <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
            }
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ACHIEVEMENTS — sidebar card
// ─────────────────────────────────────────────────────────────────
function Achievements({ address }: { address: string }) {
  const { data: stats } = useUserStats(address);

  const gamesPlayed  = stats?.gamesPlayed  ?? 0;
  const gamesWon     = stats?.gamesWon     ?? 0;
  const totalWinnings = stats?.totalWinnings ?? 0n;

  const achievements = [
    { id: "first_blood", icon: "🩸", label: "First Blood",  desc: "Play your first game",  unlocked: gamesPlayed >= 1 },
    { id: "survivor",    icon: "💀", label: "Survivor",     desc: "Play 3 games",           unlocked: gamesPlayed >= 3 },
    { id: "champion",    icon: "🏆", label: "Champion",     desc: "Win a game",             unlocked: gamesWon >= 1 },
    { id: "high_roller", icon: "💎", label: "High Roller",  desc: "Win 10+ CELO total",     unlocked: totalWinnings >= BigInt(10e18) },
    { id: "veteran",     icon: "⭐", label: "Veteran",      desc: "Play 5 games",           unlocked: gamesPlayed >= 5 },
    { id: "legend",      icon: "👑", label: "Legend",       desc: "Win 3 games",            unlocked: gamesWon >= 3 },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="bg-[#0B1445]/70 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🏅</span>
        <h3 className="text-white font-bold text-sm">Achievements</h3>
        <span className="ml-auto text-[10px] text-amber-400 font-bold">{unlockedCount}/{achievements.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {achievements.map((a) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08, y: -2 }}
            title={`${a.label}: ${a.desc}`}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border cursor-default transition-all duration-300 ${
              a.unlocked
                ? "bg-gradient-to-br from-amber-500/20 to-red-900/20 border-amber-500/30 shadow-md shadow-amber-500/10"
                : "bg-white/3 border-white/5 opacity-40 grayscale"
            }`}
          >
            <span className="text-xl">{a.icon}</span>
            <span className="text-[9px] text-center font-semibold text-gray-300 leading-tight">{a.label}</span>
            {a.unlocked && (
              <div className="w-1 h-1 rounded-full bg-amber-400 shadow-sm shadow-amber-400/60" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------- Active Games Grid ----------
function ActiveGamesGrid({
  games,
  setIsCreateGameOpen,
  onJoinClick,
}: {
  games: GameInfo[];
  setIsCreateGameOpen: (open: boolean) => void;
  onJoinClick: (game: GameInfo) => void;
}) {
  const router = useRouter();

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5"
        >
          {/* Create Game button */}
          <motion.button
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsCreateGameOpen(true)}
            className="w-full border-2 border-dashed border-red-500/40 bg-gradient-to-br from-red-500/5 to-red-900/5 text-white rounded-2xl hover:border-red-500/70 hover:bg-red-500/10 transition-all duration-300 flex flex-col items-center relative group p-5 shadow-lg hover:shadow-red-500/10 min-h-[200px]"
          >
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="p-3 rounded-full border-2 border-dashed border-red-500/40 group-hover:border-red-500/70 transition-all duration-300 group-hover:scale-110 bg-red-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-sm font-bold block mb-1 text-white">Create Game</span>
                <span className="text-xs text-gray-500">Start your own room</span>
              </div>
            </div>
          </motion.button>

          {/* Game cards */}
          {games.map((game, index) => (
            <motion.div
              key={game.gameId.toString()}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <GameDataLoader
                game={game}
                onClick={() => onJoinClick(game)}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {games.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="col-span-full text-center py-20"
        >
          <div className="bg-[#0B1445]/80 border border-white/10 rounded-2xl p-10 max-w-md mx-auto">
            <div className="text-4xl mb-4">🎰</div>
            <h3 className="text-lg font-bold text-white mb-2">No Active Games</h3>
            <p className="text-gray-500 text-sm mb-5">
              No games are running right now. Create one and invite players!
            </p>
            <button
              onClick={() => setIsCreateGameOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm shadow-lg shadow-red-600/30"
            >
              Create Game Room
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

// ---------- My Games Grid ----------
function MyGamesGrid({ address }: { address: string }) {
  const { data: fetchedMyGames, isLoading, error: myGamesError } = useMyGames();
  const setMyGames = useGameStore((state) => state.setMyGames);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (fetchedMyGames) setMyGames(fetchedMyGames);
  }, [fetchedMyGames, setMyGames]);

  const clearMyGamesError = () => {
    queryClient.resetQueries({ queryKey: ["myGames", address] });
  };

  // Use fetchedMyGames directly so statuses are always fresh from chain
  const games = fetchedMyGames ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#0B1445]/80 border border-white/5 rounded-2xl animate-pulse h-56" />
        ))}
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="text-center py-20">
        <div className="bg-[#0B1445]/80 border border-white/10 rounded-2xl p-10 max-w-md mx-auto">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-bold text-white mb-2">No Games Yet</h3>
          <p className="text-gray-500 text-sm">
            You haven&apos;t joined any games. Head to Active Games to get started.
          </p>
        </div>
      </div>
    );
  }

  const liveGames = games.filter(
    (g) => g.status === GameStatus.Active || g.status === GameStatus.InProgress
  );
  // Show BOTH Ended AND Cancelled games in history
  const pastGames = games.filter(
    (g) => g.status === GameStatus.Ended || g.status === GameStatus.Cancelled
  );

  return (
    <div className="space-y-10">
      {myGamesError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl text-red-300 text-sm flex justify-between items-center">
          <span>{myGamesError.message}</span>
          <button onClick={clearMyGamesError} className="text-red-400 hover:text-red-200 ml-2">×</button>
        </div>
      )}

      {liveGames.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Live Games
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {liveGames.map((game) => (
              <GameDataLoader
                key={game.gameId.toString()}
                game={game}
                onClick={() => router.push(`/GameScreen/${game.gameId}`)}
              />
            ))}
          </div>
        </section>
      )}

      {pastGames.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
            Game History
            <span className="ml-auto text-xs text-gray-600 normal-case tracking-normal">{pastGames.length} games</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {pastGames.map((game) => (
              <GameDataLoader
                key={game.gameId.toString()}
                game={game}
                onClick={() => router.push(`/GameScreen/${game.gameId}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Game Data Loader ----------
function GameDataLoader({ game, onClick }: { game: GameInfo; onClick: () => void }) {
  const { data: fullGame, isLoading, error } = useGameStatus(game.gameId);
  const queryClient = useQueryClient();

  const clearError = () => {
    queryClient.resetQueries({ queryKey: ["gameStatus", game.gameId.toString()] });
  };

  if (isLoading || !fullGame) {
    return <div className="bg-[#0B1445]/80 border border-white/5 p-6 rounded-2xl animate-pulse h-52" />;
  }

  return (
    <GameCard
      game={fullGame}
      error={error?.message}
      clearError={error ? clearError : undefined}
      onClick={onClick}
    />
  );
}
