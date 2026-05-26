"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getUserStats, getAllGameIds, getGameInfo } from "@/lib/contractCalls";
import { Open_Sans } from "next/font/google";
import { formatEther } from "viem";
import { RefreshCw, Trophy, Swords, Coins, Percent, Clock } from "lucide-react";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import Mascot from "@/assets/RR_LOGO_1.png";
import RRLogo from "@/assets/RR_LOGO_2_1.png";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

interface PlayerStats {
  address: string;
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: bigint;
  totalStaked: bigint;
  winRate: number;
}

// ── Cache helpers (localStorage, 5-min TTL) ───────────────────────────────────
const CACHE_KEY = "breevs_leaderboard_v2";
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  players: { address: string; gamesPlayed: number; gamesWon: number; totalWinnings: string; totalStaked: string; winRate: number }[];
  timestamp: number;
}

function readCache(): { players: PlayerStats[]; ageMs: number } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { players, timestamp }: CacheEntry = JSON.parse(raw);
    const ageMs = Date.now() - timestamp;
    if (ageMs > CACHE_TTL) return null;
    return {
      ageMs,
      players: players.map((p) => ({
        ...p,
        totalWinnings: BigInt(p.totalWinnings),
        totalStaked:   BigInt(p.totalStaked),
      })),
    };
  } catch { return null; }
}

function writeCache(players: PlayerStats[]) {
  try {
    const entry: CacheEntry = {
      timestamp: Date.now(),
      players: players.map((p) => ({
        ...p,
        totalWinnings: p.totalWinnings.toString(),
        totalStaked:   p.totalStaked.toString(),
      })),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

type SortKey = "winrate" | "winnings" | "games";

const SORT_OPTS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: "winrate",  label: "Survival Rate", icon: <Percent  className="w-3.5 h-3.5" /> },
  { key: "winnings", label: "CELO Earned",   icon: <Coins    className="w-3.5 h-3.5" /> },
  { key: "games",    label: "Matches",        icon: <Swords   className="w-3.5 h-3.5" /> },
];

const fmt    = (v: bigint) => parseFloat(formatEther(v)).toFixed(2);
const short  = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const shortS = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const init   = (a: string) => a.slice(2, 4).toUpperCase();

const rankText  = (r: number) => r === 1 ? "text-yellow-400" : r === 2 ? "text-slate-300" : r === 3 ? "text-orange-400" : "text-gray-600";
const rankBg    = (r: number) => r === 1 ? "border-yellow-400/40 bg-yellow-950/20" : r === 2 ? "border-slate-400/30 bg-slate-800/20" : r === 3 ? "border-orange-500/30 bg-orange-950/20" : "border-white/5 bg-white/[0.02]";
const rankBorder= (r: number) => r === 1 ? "border-yellow-400/50" : r === 2 ? "border-slate-300/40" : r === 3 ? "border-orange-400/40" : "border-white/10";
const MEDALS    = ["🥇","🥈","🥉"];

export default function LeaderboardPage() {
  const [players,    setPlayers]    = useState<PlayerStats[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [sort,       setSort]       = useState<SortKey>("winrate");
  const [refreshing, setRefreshing] = useState(false);
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(null);

  useEffect(() => {
    // Try to load from cache immediately (no spinner)
    const cached = readCache();
    if (cached) {
      setPlayers(cached.players);
      setCacheAgeMs(cached.ageMs);
      setLoading(false);
    } else {
      load(false);
    }
  }, []);

  const load = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const gameIds = await getAllGameIds();
      const map = new Map<string, PlayerStats>();

      for (const id of gameIds) {
        try {
          const info = await getGameInfo(id);
          for (const addr of info.players) {
            if (map.has(addr)) continue;
            const s = await getUserStats(addr);
            map.set(addr, {
              address:       addr,
              gamesPlayed:   s.gamesPlayed,
              gamesWon:      s.gamesWon,
              totalWinnings: s.totalWinnings,
              totalStaked:   s.totalStaked,
              winRate: s.gamesPlayed > 0 ? (s.gamesWon / s.gamesPlayed) * 100 : 0,
            });
          }
        } catch { /* skip bad game */ }
      }
      const freshPlayers = Array.from(map.values());
      setPlayers(freshPlayers);
      writeCache(freshPlayers);
      setCacheAgeMs(0);
    } catch {
      setError("Could not load leaderboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sorted = [...players].sort((a, b) => {
    if (sort === "winrate")  return b.winRate - a.winRate || Number(b.totalWinnings - a.totalWinnings);
    if (sort === "winnings") return Number(b.totalWinnings - a.totalWinnings);
    return b.gamesPlayed - a.gamesPlayed;
  });

  const top3 = sorted.slice(0, 3);

  const cacheLabel = (() => {
    if (cacheAgeMs === null) return null;
    if (cacheAgeMs < 60000) return "just now";
    return `${Math.floor(cacheAgeMs / 60000)}m ago`;
  })();

  /* ── Loading (first paint, no cache) ── */
  if (loading) return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} min-h-screen flex flex-col`}>
        <Header onRefresh={() => load(true)} refreshing={false} total={undefined} cacheLabel={null} />
        <div className="flex-1 flex items-center justify-center gap-8 px-6">
          <Image src={Mascot} alt="" width={100} height={100} className="opacity-20 animate-pulse hidden sm:block" />
          <div>
            <p className="text-white font-bold text-xl mb-1">Scanning the battlefield…</p>
            <p className="text-gray-600 text-sm">Reading all game records on-chain</p>
            <div className="mt-4 h-0.5 w-56 bg-white/5 rounded overflow-hidden">
              <motion.div
                className="h-full bg-red-600 rounded"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );

  if (error) return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} min-h-screen flex flex-col`}>
        <Header onRefresh={() => load(true)} refreshing={false} total={undefined} cacheLabel={null} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-xs">
            <p className="text-5xl mb-4">💀</p>
            <p className="text-white font-bold mb-2">{error}</p>
            <button onClick={() => load()} className="mt-4 px-6 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-all">
              Try Again
            </button>
          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );

  return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} min-h-screen pb-24`}>

        <Header onRefresh={() => load(true)} refreshing={refreshing} total={players.length} cacheLabel={cacheLabel} />

        {/* ── Desktop two-column / mobile single-column ── */}
        <div className="max-w-screen-xl mx-auto px-4 pt-6 flex gap-6 items-start">

          {/* ══════════════════════════════
              LEFT — ranked list (grows)
          ══════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Sort tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {SORT_OPTS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    sort === key
                      ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30"
                      : "bg-white/3 border-white/8 text-gray-500 hover:text-white hover:border-white/20"
                  }`}
                >
                  {icon} {label}
                </button>
              ))}

              {/* Refresh spinner inline with tabs while refreshing */}
              {refreshing && (
                <div className="flex items-center gap-1.5 text-gray-600 text-xs ml-auto">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Updating…</span>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_2fr_1fr_1fr_1fr] gap-3 px-4 pb-1 border-b border-white/5">
              <span className="text-[10px] text-gray-700 uppercase tracking-widest">#</span>
              <span className="text-[10px] text-gray-700 uppercase tracking-widest">Player</span>
              <span className="hidden sm:block text-[10px] text-gray-700 uppercase tracking-widest text-right">Survival</span>
              <span className="hidden sm:block text-[10px] text-gray-700 uppercase tracking-widest text-right">W / G</span>
              <span className="text-[10px] text-gray-700 uppercase tracking-widest text-right">
                {sort === "winnings" ? "CELO" : sort === "games" ? "Matches" : "Rate"}
              </span>
            </div>

            {/* Rows */}
            <div className="space-y-1.5">
              <AnimatePresence mode="wait">
                {sorted.map((p, i) => {
                  const rank   = i + 1;
                  const inTop3 = rank <= 3;

                  const stat =
                    sort === "winrate"  ? `${p.winRate.toFixed(1)}%`
                  : sort === "winnings" ? `${fmt(p.totalWinnings)} ₵`
                  : String(p.gamesPlayed);

                  return (
                    <motion.div
                      key={p.address + sort}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.35) }}
                      className={`grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[2.5rem_2fr_1fr_1fr_1fr] items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-200 ${rankBg(rank)}`}
                    >
                      {/* Rank */}
                      <span className={`text-sm font-black text-center ${rankText(rank)}`}>
                        {inTop3 ? MEDALS[rank - 1] : rank}
                      </span>

                      {/* Player */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full border flex-shrink-0 flex items-center justify-center text-xs font-black ${rankBorder(rank)} ${rankText(rank)}`}
                          style={{ background: "linear-gradient(135deg,#0d0d1a,#050508)" }}
                        >
                          {init(p.address)}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold font-mono truncate ${inTop3 ? "text-white" : "text-gray-400"}`}>
                            <span className="hidden md:inline">{short(p.address)}</span>
                            <span className="md:hidden">{shortS(p.address)}</span>
                          </p>
                          <p className="sm:hidden text-[10px] text-gray-600 mt-0.5">
                            {p.gamesWon}W · {p.gamesPlayed}G
                          </p>
                        </div>
                      </div>

                      {/* Survival bar — desktop only */}
                      <div className="hidden sm:flex items-center gap-2 justify-end">
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-300" : rank === 3 ? "bg-orange-400" : "bg-red-700/60"}`}
                            style={{ width: `${Math.min(p.winRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{p.winRate.toFixed(0)}%</span>
                      </div>

                      {/* W/G — desktop only */}
                      <p className="hidden sm:block text-xs text-gray-500 text-right">
                        {p.gamesWon}<span className="text-gray-700">/{p.gamesPlayed}</span>
                      </p>

                      {/* Primary stat */}
                      <p className={`text-sm font-black text-right ${inTop3 ? rankText(rank) : "text-gray-400"}`}>
                        {stat}
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {sorted.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-3xl mb-3">🎰</p>
                  <p className="text-gray-600 text-sm">No players on record yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════
              RIGHT — sticky spotlight sidebar (desktop only)
          ══════════════════════════════ */}
          <aside className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 shrink-0 sticky top-24 self-start">

            {/* Mascot + branding */}
            <div
              className="relative rounded-2xl overflow-hidden border border-white/5 p-5"
              style={{ background: "linear-gradient(160deg,#120308 0%,#06020a 100%)" }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(220,38,38,0.08),transparent_60%)] pointer-events-none" />
              <div className="h-px w-full bg-gradient-to-r from-transparent via-red-700/40 to-transparent absolute top-0 left-0" />

              <div className="relative flex items-end gap-4">
                <Image src={Mascot} alt="" width={80} height={90} className="object-contain opacity-90 drop-shadow-2xl" />
                <div>
                  <div className="relative w-24 h-12 mb-1">
                    <Image src={RRLogo} alt="Russian Roulette" fill className="object-contain object-left" />
                  </div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">Kill Board</p>
                  <p className="text-[10px] text-gray-700">{players.length} players</p>
                </div>
              </div>
            </div>

            {/* Top 3 Spotlight */}
            {top3.length > 0 && (
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#07070f" }}>
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Top Survivors</span>
                </div>

                {top3.map((p, i) => {
                  const rank = i + 1;
                  return (
                    <div
                      key={p.address}
                      className={`flex items-center gap-3 px-4 py-3.5 ${i < top3.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                    >
                      <div className="relative shrink-0">
                        {rank === 1 && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-base">👑</span>
                        )}
                        <div
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-black mt-1 ${rankBorder(rank)} ${rankText(rank)}`}
                          style={{ background: "linear-gradient(135deg,#0f0f20,#060610)" }}
                        >
                          {init(p.address)}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-base leading-none">{MEDALS[i]}</span>
                          <p className={`text-xs font-bold font-mono truncate ${rankText(rank)}`}>
                            {shortS(p.address)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-0.5 bg-white/5 rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-slate-300" : "bg-orange-400"}`}
                              style={{ width: `${Math.min(p.winRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-600 shrink-0">{p.winRate.toFixed(0)}%</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black ${rankText(rank)}`}>{fmt(p.totalWinnings)}</p>
                        <p className="text-[9px] text-gray-700">CELO</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats summary */}
            {players.length > 0 && (
              <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#07070f" }}>
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest">Board Stats</span>
                </div>
                {[
                  { label: "Total Players",  value: players.length },
                  { label: "Total Winners",  value: players.filter(p => p.gamesWon > 0).length },
                  { label: "Most Matches",   value: `${Math.max(...players.map(p => p.gamesPlayed))}G` },
                  { label: "Top Win Rate",   value: `${(Math.max(...players.map(p => p.winRate))).toFixed(0)}%` },
                ].map((s, i, arr) => (
                  <div key={s.label} className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
                    <span className="text-xs text-gray-500">{s.label}</span>
                    <span className="text-sm font-black text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>

        </div>
      </div>
    </BackgroundImgBlur>
  );
}

/* ── Sticky header ─────────────────────────────────────────────── */
function Header({
  onRefresh,
  refreshing,
  total,
  cacheLabel,
}: {
  onRefresh: () => void;
  refreshing: boolean;
  total: number | undefined;
  cacheLabel: string | null;
}) {
  return (
    <div className="sticky top-0 z-40 bg-[#030B1F]/90 backdrop-blur-md border-b border-white/5">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="relative w-20 h-10 shrink-0 hidden sm:block">
          <Image src={RRLogo} alt="Russian Roulette" fill className="object-contain object-left" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-white leading-none tracking-tight flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            Kill Board
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {total !== undefined ? (
              <p className="text-[10px] text-gray-600">{total} players · all-time rankings</p>
            ) : (
              <p className="text-[10px] text-gray-600">All-time player rankings</p>
            )}
            {cacheLabel && (
              <div className="flex items-center gap-1 text-[10px] text-gray-700">
                <Clock className="w-2.5 h-2.5" />
                <span>cached {cacheLabel}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 text-gray-500 hover:text-white text-xs font-bold transition-all disabled:opacity-30"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );
}
