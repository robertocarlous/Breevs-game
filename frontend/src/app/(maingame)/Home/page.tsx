"use client";

import { useState, useEffect, useRef } from "react";
import { Anton, Open_Sans } from "next/font/google";
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
import { ConnectButton } from "@rainbow-me/rainbowkit";
import HowToPlayModal from "@/component/HowToPlayModal";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"] });
const anton = Anton({ subsets: ["latin"], weight: ["400"] });

export default function HomePage() {
  const { isConnected, address } = useAccount();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  const [showFreeTrial, setShowFreeTrial] = useState(false);

  const {
    activeTab, setActiveTab, filters, setFilters,
    activeGames, setActiveGames, setMyGames, setSelectedGame,
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
      const statusOk =
        filters.status === GameStatus.Active
          ? game.status === GameStatus.Active || game.status === GameStatus.InProgress
          : game.status === filters.status;
      return stakeOk && statusOk;
    })
    .sort(() => (filters.sortBy === "newest" ? (filters.sortOrder === "desc" ? -1 : 1) : 0));

  const isFiltersApplied =
    filters.sortBy !== "newest" || filters.sortOrder !== "desc" ||
    filters.minStake !== "0" || filters.status !== GameStatus.Active;

  const handleGameCardClick = (game: GameInfo) => {
    if (!isConnected) { setShowConnectPrompt(true); return; }
    setSelectedGame(game);
    setIsStakeModalOpen(true);
  };

  const liveCount = activeGames.filter(
    (g) => g.status === GameStatus.Active || g.status === GameStatus.InProgress
  ).length;

  return (
    <BackgroundImgBlur>
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <FreeTrialModal isOpen={showFreeTrial} onClose={() => setShowFreeTrial(false)} />

      {/* ── Connect prompt ── */}
      <AnimatePresence>
        {showConnectPrompt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowConnectPrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[#030710] border border-white/8 w-full max-w-xs shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
              <div className="p-7 text-center">
                <p className="text-[9px] text-red-500/70 uppercase tracking-[0.3em] mb-3">Access Required</p>
                <h3 className={`${anton.className} text-3xl text-white mb-1`}>IDENTIFY</h3>
                <h3 className={`${anton.className} text-3xl text-red-500 mb-4`}>YOURSELF.</h3>
                <p className="text-gray-500 text-xs leading-relaxed mb-6">
                  Connect your wallet to stake and take a seat at this table.
                </p>
                <div className="space-y-2">
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) =>
                      mounted ? (
                        <button onClick={openConnectModal}
                          className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_30px_rgba(220,38,38,0.25)]">
                          Connect Wallet
                        </button>
                      ) : null
                    }
                  </ConnectButton.Custom>
                  <button onClick={() => setShowConnectPrompt(false)}
                    className="w-full text-gray-600 hover:text-gray-300 text-[10px] uppercase tracking-widest transition-colors py-2">
                    Continue watching
                  </button>
                </div>
              </div>
              <div className="h-[1px] bg-gradient-to-r from-transparent via-red-600/30 to-transparent" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${openSans.className} relative w-full min-h-screen`}>

        {/* ── Header ── */}
        <div className="fixed top-0 z-50 w-full bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
          <div className="max-w-screen-xl mx-auto px-5 py-3 flex items-center gap-4">
            {/* Brand */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div>
                <span className={`${anton.className} text-red-500 text-xl tracking-tight`}>BREEVS</span>
                <span className="text-gray-700 text-xs ml-2 hidden sm:inline uppercase tracking-widest">Russian Roulette</span>
              </div>
              {/* Live pill */}
              {liveCount > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 bg-red-600/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">{liveCount} Live</span>
                </div>
              )}
            </div>

            <button onClick={() => setShowFreeTrial(true)}
              className="text-amber-500/80 hover:text-amber-400 text-[10px] uppercase tracking-widest transition-colors hidden sm:flex items-center gap-1.5 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Free Trial
            </button>
            <button onClick={() => setShowHowToPlay(true)}
              className="text-gray-600 hover:text-gray-300 text-[10px] uppercase tracking-widest transition-colors hidden sm:block">
              How to Play
            </button>

            <ConnectButton.Custom>
              {({ account, openConnectModal, openAccountModal, mounted }) => {
                if (!mounted) return null;
                if (!account) return (
                  <button onClick={openConnectModal}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-black px-4 py-2 uppercase tracking-widest transition-all">
                    Connect
                  </button>
                );
                return (
                  <button onClick={openAccountModal}
                    className="border border-white/10 hover:border-white/20 text-white text-xs font-semibold px-3 py-1.5 transition-all">
                    {account.displayName}
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* ── Page body ── */}
        <div className="pt-[60px] w-full max-w-screen-2xl mx-auto px-4 sm:px-5 pb-24">

          <CreateGameModal isOpen={isCreateGameOpen} onClose={() => setIsCreateGameOpen(false)} />
          <StakeModal
            isOpen={isStakeModalOpen}
            onClose={() => { setIsStakeModalOpen(false); setSelectedGame(null); }}
          />
          <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)}>
            <div className="bg-[#030B1F] text-white p-6 border border-white/10 max-w-sm w-full">
              <h2 className="text-base font-black text-white mb-5 uppercase tracking-widest">Filter Rooms</h2>
              <GameFilter
                onFilterChange={(newFilters) => {
                  setFilters({
                    sortBy: newFilters.sortBy, sortOrder: newFilters.sortOrder,
                    minStake: newFilters.minStake ?? "0", status: newFilters.status ?? GameStatus.Active,
                  });
                  setIsFilterOpen(false);
                }}
              />
            </div>
          </Modal>

          {/* ── Two-column layout ── */}
          <div className="flex gap-6 items-start mt-5">

            {/* ── LEFT: game feed ── */}
            <div className="flex-1 min-w-0">

              {/* Spectator strip */}
              {!isConnected && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 flex items-center gap-3 border-l-2 border-red-600/50 bg-red-950/10 pl-3 pr-4 py-2">
                  <p className="text-gray-500 text-[10px] uppercase tracking-widest flex-1">
                    Observer mode — connect to join or create a room
                  </p>
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) =>
                      mounted ? (
                        <button onClick={openConnectModal}
                          className="text-red-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors shrink-0">
                          Connect →
                        </button>
                      ) : null
                    }
                  </ConnectButton.Custom>
                </motion.div>
              )}

              {/* Editorial tabs */}
              <div className="flex items-end justify-between border-b border-white/[0.07] mb-6">
                <div className="flex gap-0">
                  {[
                    { id: "active", label: "Open Rooms", count: filteredActiveGames.length },
                    { id: "my-games", label: "My History", count: null },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() =>
                        tab.id === "my-games" && !isConnected
                          ? setShowConnectPrompt(true)
                          : setActiveTab(tab.id as "active" | "my-games")
                      }
                      className={`relative px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === tab.id
                          ? "text-white"
                          : "text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {tab.label}
                      {tab.count !== null && tab.count > 0 && (
                        <span className="ml-1.5 text-red-500">{tab.count}</span>
                      )}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="tab-underline"
                          className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600"
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Filter btn — only on active tab */}
                {isConnected && activeTab === "active" && (
                  <button onClick={() => setIsFilterOpen(true)}
                    className={`mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-colors pb-3 ${
                      isFiltersApplied ? "text-red-400" : "text-gray-600 hover:text-gray-400"
                    }`}>
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                    Filter {isFiltersApplied && "·"}
                  </button>
                )}
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                {isLoadingGames || isLoadingMyGames ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-white/3 border border-white/5 animate-pulse h-52" />
                    ))}
                  </motion.div>
                ) : activeTab === "active" ? (
                  <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ActiveGamesGrid
                      games={filteredActiveGames}
                      setIsCreateGameOpen={isConnected ? setIsCreateGameOpen : () => setShowConnectPrompt(true)}
                      onJoinClick={handleGameCardClick}
                    />
                  </motion.div>
                ) : address ? (
                  <motion.div key="my" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <MyGamesGrid address={address} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Mobile sidebar */}
              {isConnected && address && (
                <div className="xl:hidden mt-10 space-y-4">
                  <LiveBoard activeCount={liveCount} />
                  <DailyContracts address={address} />
                  <Achievements address={address} />
                </div>
              )}
              {!isConnected && (
                <div className="xl:hidden mt-10">
                  <LiveBoard activeCount={liveCount} />
                </div>
              )}
            </div>

            {/* ── RIGHT: Sidebar ── */}
            {isConnected && address ? (
              <aside className="hidden xl:flex flex-col gap-4 w-64 shrink-0 sticky top-[68px] self-start max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-none pb-4">
                <LiveBoard activeCount={liveCount} />
                <DailyContracts address={address} />
                <Achievements address={address} />
              </aside>
            ) : (
              <aside className="hidden xl:block w-56 shrink-0 sticky top-[68px] self-start">
                <LiveBoard activeCount={liveCount} />
              </aside>
            )}
          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );
}

// ─────────────────────────────────────────────────────────
// LIVE BOARD — dramatic vertical stats
// ─────────────────────────────────────────────────────────
function LiveBoard({ activeCount }: { activeCount: number }) {
  const { data: gameCounter } = useTotalGames();
  const total = Number(gameCounter ?? 0n);

  const rows = [
    { value: total > 0 ? total.toLocaleString() : "—", label: "Games played" },
    { value: activeCount > 0 ? String(activeCount) : "0", label: "Rooms live now", live: activeCount > 0 },
    { value: "6", label: "Seats per room" },
    { value: "100%", label: "Winner takes all" },
  ];

  return (
    <div className="border border-white/[0.07] bg-black/40">
      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em]">Live Intelligence</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < rows.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest">{row.label}</p>
          <div className="flex items-center gap-1.5">
            {row.live && <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />}
            <span className={`${anton.className} text-lg leading-none ${row.live ? "text-red-400" : "text-white"}`}>
              {row.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DAILY MISSIONS — original visual design restored
// ─────────────────────────────────────────────────────────
function DailyContracts({ address }: { address: string }) {
  const { data: stats } = useUserStats(address);
  const { myGames } = useGameStore();

  const today = new Date().toDateString();
  const storageKey = `breevs_missions_${address}_${today}`;
  const getCompleted = (): string[] => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  };
  const completed = getCompleted();

  const inActiveGame = myGames.some((g) => g.status === GameStatus.Active || g.status === GameStatus.InProgress);
  const inRound3Plus = myGames.some((g) => g.status === GameStatus.InProgress && g.currentRound >= 3);
  const wonToday = (stats?.gamesWon ?? 0) > 0;

  const missions = [
    { id: "join",    icon: "🎮", label: "Join or create a game", reward: "🎖️ Contender Badge", done: inActiveGame || completed.includes("join") },
    { id: "survive", icon: "⚔️", label: "Survive into Round 3",  reward: "💀 Survivor Badge",   done: inRound3Plus || completed.includes("survive") },
    { id: "win",     icon: "🏆", label: "Win a game",             reward: "👑 Champion Badge",   done: wonToday || completed.includes("win") },
  ];

  const doneCount = missions.filter((m) => m.done).length;

  return (
    <div className="bg-[#0B1445]/70 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🎯</span>
        <h3 className="text-white font-bold text-sm">Daily Missions</h3>
        <span className="ml-auto text-[10px] text-gray-500">Resets UTC</span>
      </div>
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

// ─────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────
function Achievements({ address }: { address: string }) {
  const { data: stats } = useUserStats(address);
  const [showGoatCelebration, setShowGoatCelebration] = useState(false);
  const celebrationKey = `breevs_goat_celebrated_${address}`;
  const prevUnlockedRef = useRef<number>(-1);

  const gamesPlayed   = stats?.gamesPlayed  ?? 0;
  const gamesWon      = stats?.gamesWon     ?? 0;
  const totalWinnings = stats?.totalWinnings ?? 0n;

  const list = [
    { id: "first_blood", symbol: "🩸", label: "First Blood",  desc: "Play 1 game",       unlocked: gamesPlayed >= 1 },
    { id: "survivor",    symbol: "💀", label: "Survivor",     desc: "Play 3 games",       unlocked: gamesPlayed >= 3 },
    { id: "champion",    symbol: "🏆", label: "Champion",     desc: "Win 1 game",         unlocked: gamesWon >= 1 },
    { id: "high_roller", symbol: "💎", label: "High Roller",  desc: "Win 10+ CELO",       unlocked: totalWinnings >= BigInt(10e18) },
    { id: "veteran",     symbol: "⭐", label: "Veteran",      desc: "Play 5 games",       unlocked: gamesPlayed >= 5 },
    { id: "legend",      symbol: "👑", label: "Legend",       desc: "Win 3 games",        unlocked: gamesWon >= 3 },
  ];

  const unlockedCount = list.filter((a) => a.unlocked).length;
  const isGoat = unlockedCount === list.length;

  useEffect(() => {
    if (unlockedCount === 0) return;
    const alreadyCelebrated = localStorage.getItem(celebrationKey) === "1";
    if (isGoat && !alreadyCelebrated && prevUnlockedRef.current !== -1) {
      localStorage.setItem(celebrationKey, "1");
      setShowGoatCelebration(true);
      setTimeout(() => setShowGoatCelebration(false), 5000);
    }
    prevUnlockedRef.current = unlockedCount;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount, isGoat]);

  return (
    <>
      <AnimatePresence>
        {showGoatCelebration && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] pointer-events-none px-6 py-4 border border-yellow-400/50 bg-black/95 shadow-2xl shadow-yellow-500/20 text-center min-w-[260px]"
          >
            <div className="text-3xl mb-1">🐐</div>
            <p className="text-yellow-300 font-black text-sm uppercase tracking-widest">THE GOAT</p>
            <p className="text-amber-400/70 text-[10px] mt-1 uppercase tracking-widest">All achievements unlocked</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={isGoat ? { boxShadow: ["0 0 0px rgba(251,191,36,0)", "0 0 16px rgba(251,191,36,0.3)", "0 0 0px rgba(251,191,36,0)"] } : {}}
        transition={{ duration: 2.5, repeat: Infinity }}
        className={`border ${isGoat ? "border-yellow-500/30 bg-yellow-950/10" : "border-white/[0.07] bg-black/40"}`}
      >
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em]">Achievements</p>
          <p className={`text-[9px] uppercase tracking-widest font-black ${isGoat ? "text-yellow-400" : "text-gray-700"}`}>
            {isGoat ? "GOAT" : `${unlockedCount}/6`}
          </p>
        </div>

        <div className="grid grid-cols-3">
          {list.map((a, i) => (
            <motion.div
              key={a.id}
              whileHover={{ scale: 1.04 }}
              title={`${a.label}: ${a.desc}`}
              className={`flex flex-col items-center gap-1 py-3 px-2 border-b border-r border-white/[0.04] cursor-default transition-all ${
                i % 3 === 2 ? "border-r-0" : ""
              } ${i >= 3 ? "border-b-0" : ""} ${
                a.unlocked ? "" : "opacity-25 grayscale"
              }`}
            >
              <span className="text-lg">{a.symbol}</span>
              <span className="text-[8px] text-center text-gray-500 leading-tight">{a.label}</span>
              {a.unlocked && <div className="w-1 h-1 rounded-full bg-amber-400" />}
            </motion.div>
          ))}
        </div>

        {/* GOAT row */}
        <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-3">
          <span className={`text-xl shrink-0 ${!isGoat ? "grayscale opacity-20" : ""}`}>
            {isGoat ? "🐐" : "❓"}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isGoat ? "text-yellow-300" : "text-gray-700"}`}>
              {isGoat ? "THE GOAT" : "???"}
            </p>
            <p className={`text-[9px] leading-tight mt-0.5 ${isGoat ? "text-amber-400/60" : "text-gray-800"}`}>
              {isGoat ? "Breevs Legend. Unkillable." : "Unlock all 6 to reveal."}
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// ACTIVE GAMES GRID
// ─────────────────────────────────────────────────────────
function ActiveGamesGrid({
  games, setIsCreateGameOpen, onJoinClick,
}: {
  games: GameInfo[];
  setIsCreateGameOpen: (open: boolean) => void;
  onJoinClick: (game: GameInfo) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Create room card */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateGameOpen(true)}
          className="group relative border border-dashed border-red-600/25 hover:border-red-600/60 bg-red-950/5 hover:bg-red-950/15 transition-all duration-300 flex flex-col items-center justify-center gap-3 min-h-[200px] p-5"
        >
          <div className="w-10 h-10 border border-dashed border-red-600/40 group-hover:border-red-500/70 flex items-center justify-center transition-all">
            <svg className="w-5 h-5 text-red-600/60 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-xs font-black text-red-600/70 group-hover:text-red-500 uppercase tracking-widest transition-colors">New Room</p>
            <p className="text-[9px] text-gray-700 mt-0.5 uppercase tracking-widest">Start your table</p>
          </div>
        </motion.button>

        {/* Game cards */}
        {games.map((game, i) => (
          <motion.div key={game.gameId.toString()}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}>
            <GameDataLoader game={game} onClick={() => onJoinClick(game)} />
          </motion.div>
        ))}
      </div>

      {games.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <div className="border border-white/[0.07] bg-black/20 p-12 text-center max-w-md mx-auto">
            <p className={`${anton.className} text-5xl text-white/10 mb-4`}>EMPTY</p>
            <p className="text-gray-600 text-xs uppercase tracking-widest mb-5">
              No rooms open right now. Be the first.
            </p>
            <button onClick={() => setIsCreateGameOpen(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-black py-3 px-8 text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_30px_rgba(220,38,38,0.2)]">
              Open a Room
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// MY GAMES — battle log
// ─────────────────────────────────────────────────────────
function MyGamesGrid({ address }: { address: string }) {
  const { data: fetchedMyGames, isLoading, error: myGamesError } = useMyGames();
  const setMyGames = useGameStore((state) => state.setMyGames);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (fetchedMyGames) setMyGames(fetchedMyGames);
  }, [fetchedMyGames, setMyGames]);

  const games = fetchedMyGames ?? [];

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!games.length) {
    return (
      <div className="border border-white/[0.07] p-14 text-center max-w-md">
        <p className={`${anton.className} text-4xl text-white/10 mb-3`}>NO HISTORY</p>
        <p className="text-gray-600 text-xs uppercase tracking-widest">You have not joined any games yet.</p>
      </div>
    );
  }

  const liveGames = games.filter((g) => g.status === GameStatus.Active || g.status === GameStatus.InProgress);
  const pastGames = games.filter((g) => g.status === GameStatus.Ended || g.status === GameStatus.Cancelled);

  return (
    <div className="space-y-8">
      {myGamesError && (
        <div className="flex items-center justify-between border-l-2 border-red-600 bg-red-950/10 px-4 py-2 text-red-400 text-xs">
          <span>{myGamesError.message}</span>
          <button onClick={() => queryClient.resetQueries({ queryKey: ["myGames", address] })} className="ml-3 hover:text-white">×</button>
        </div>
      )}

      {/* Live games — still show as cards */}
      {liveGames.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em]">Active Tables</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {liveGames.map((game) => (
              <GameDataLoader key={game.gameId.toString()} game={game}
                onClick={() => router.push(`/GameScreen/${game.gameId}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Past games — cards */}
      {pastGames.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
              <p className="text-[9px] text-gray-500 uppercase tracking-[0.3em]">Game History</p>
            </div>
            <p className="text-[9px] text-gray-700 uppercase tracking-widest">{pastGames.length} games</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pastGames.map((game, i) => (
              <motion.div key={game.gameId.toString()}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}>
                <GameDataLoader game={game} onClick={() => router.push(`/GameScreen/${game.gameId}`)} />
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// GAME DATA LOADER
// ─────────────────────────────────────────────────────────
function GameDataLoader({ game, onClick }: { game: GameInfo; onClick: () => void }) {
  const { data: fullGame, isLoading, error } = useGameStatus(game.gameId);
  const queryClient = useQueryClient();

  const clearError = () => queryClient.resetQueries({ queryKey: ["gameStatus", game.gameId.toString()] });

  if (isLoading || !fullGame) {
    return <div className="bg-white/[0.03] border border-white/5 animate-pulse h-52" />;
  }

  return (
    <GameCard game={fullGame} error={error?.message} clearError={error ? clearError : undefined} onClick={onClick} />
  );
}

// ─────────────────────────────────────────────────────────
// FREE TRIAL MODAL
// ─────────────────────────────────────────────────────────
function FreeTrialModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const { isConnected } = useAccount();

  const tiers = [
    {
      name: "Observer",
      price: "Free",
      priceNote: "No wallet needed",
      highlight: false,
      perks: [
        "Browse all open rooms",
        "Watch any live game in real time",
        "See player eliminations live",
        "Learn the game before risking anything",
      ],
      cta: "Watch Now",
      action: () => { onClose(); },
    },
    {
      name: "Player",
      price: "0.2 CELO",
      priceNote: "Min stake per game",
      highlight: true,
      perks: [
        "Everything in Observer",
        "Join or create game rooms",
        "Stake and compete for the full prize pool",
        "Earn badges and achievements",
        "Winner takes 100% — no house cut",
      ],
      cta: isConnected ? "Find a Room" : "Connect & Play",
      action: () => { onClose(); router.push("/Home"); },
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="w-full max-w-lg bg-[#030710] border border-white/8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        <div className="px-7 pt-6 pb-5 border-b border-white/[0.07]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-amber-500/70 text-[9px] uppercase tracking-[0.35em] mb-2">Pricing</p>
              <h2 className={`${anton.className} text-4xl text-white leading-none`}>FREE</h2>
              <h2 className={`${anton.className} text-4xl text-amber-500 leading-none`}>TO WATCH.</h2>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-2">Pay only when you play</p>
            </div>
            <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-lg w-7 h-7 flex items-center justify-center">×</button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-white/[0.06] p-6 gap-0">
          {tiers.map((tier) => (
            <div key={tier.name} className={`px-4 py-2 ${tier.highlight ? "relative" : ""}`}>
              {tier.highlight && (
                <div className="absolute -top-2 left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
              )}
              <p className={`text-[9px] uppercase tracking-[0.3em] mb-1 ${tier.highlight ? "text-red-500/70" : "text-gray-600"}`}>
                {tier.name}
              </p>
              <p className={`${anton.className} text-2xl leading-none mb-0.5 ${tier.highlight ? "text-white" : "text-gray-400"}`}>
                {tier.price}
              </p>
              <p className="text-[9px] text-gray-700 uppercase tracking-widest mb-5">{tier.priceNote}</p>

              <ul className="space-y-2.5 mb-6">
                {tier.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-gray-400">
                    <span className={`mt-0.5 shrink-0 ${tier.highlight ? "text-red-500" : "text-gray-700"}`}>✓</span>
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                onClick={tier.action}
                className={`w-full py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                  tier.highlight
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.25)]"
                    : "border border-white/10 hover:border-white/25 text-gray-400 hover:text-white"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="px-7 pb-5 border-t border-white/[0.06] pt-4">
          <p className="text-[9px] text-gray-700 text-center leading-relaxed">
            Full free-game mode (play without staking) requires a smart contract upgrade — coming soon.
            For now, Observer mode is your free tier.
          </p>
        </div>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </motion.div>
    </div>
  );
}
