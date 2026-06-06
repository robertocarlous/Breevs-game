"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Open_Sans } from "next/font/google";
import { formatEther as fmtEther } from "viem";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Copy, Check, LogOut } from "lucide-react";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import { useUserStats, useMyGames, useGDBalance } from "@/hooks/useGame";
import { GameStatus } from "@/lib/contractCalls";
import { useRouter } from "next/navigation";
import Mascot from "@/assets/RR_LOGO_1.png";
import GoodDollarPanel from "@/component/GoodDollarPanel";
import PointsSummary from "@/component/PointsSummary";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const { disconnect }           = useDisconnect();
  const router                   = useRouter();
  const [copied, setCopied]      = useState(false);
  const [histTab, setHistTab]    = useState<"all" | "won" | "lost">("all");

  const { data: gdBalance = 0n }                               = useGDBalance(address);
  const { data: stats }                                        = useUserStats(address ?? "");
  const { data: myGames = [], isLoading: gamesLoading }        = useMyGames();

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const winRate  = stats?.gamesPlayed ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(0) : "0";
  const totalWon = stats ? parseFloat(fmtEther(stats.totalWinnings)).toFixed(3) : "0.000";
  const totalStk = stats ? parseFloat(fmtEther(stats.totalStaked)).toFixed(3)   : "0.000";
  const netPnl   = stats
    ? (parseFloat(fmtEther(stats.totalWinnings)) - parseFloat(fmtEther(stats.totalStaked))).toFixed(3)
    : "0.000";
  const inProfit  = parseFloat(netPnl) >= 0;
  const gdDisplay = parseFloat(fmtEther(gdBalance)).toFixed(2);

  const liveGames = myGames.filter(g => g.status === GameStatus.Active || g.status === GameStatus.InProgress);
  const pastGames = myGames
    .filter(g => g.status === GameStatus.Ended || g.status === GameStatus.Cancelled)
    .reverse();

  const filteredHistory = pastGames.filter(g => {
    if (histTab === "won")  return g.status === GameStatus.Ended && g.winner?.toLowerCase() === address?.toLowerCase();
    if (histTab === "lost") return g.status === GameStatus.Ended && g.winner?.toLowerCase() !== address?.toLowerCase();
    return true;
  });

  /* ── Not connected ── */
  if (!isConnected) return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} min-h-screen flex items-center justify-center px-4`}>
        <div className="text-center max-w-xs">
          <Image src={Mascot} alt="" width={120} height={120} className="mx-auto mb-6 drop-shadow-2xl" />
          <h2 className="text-xl font-black text-white mb-2">Who are you, stranger?</h2>
          <p className="text-gray-500 text-sm mb-6">Connect your wallet to access your player dossier.</p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) =>
              mounted ? (
                <button
                  onClick={openConnectModal}
                  className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-xl shadow-red-900/40"
                >
                  Connect Wallet
                </button>
              ) : null
            }
          </ConnectButton.Custom>
        </div>
      </div>
    </BackgroundImgBlur>
  );

  return (
    <BackgroundImgBlur>
      <div className={`${openSans.className} min-h-screen pb-28`}>

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-40 bg-[#030B1F]/90 backdrop-blur-md border-b border-white/5">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <h1 className="text-sm font-black text-white tracking-widest uppercase">Player Dossier</h1>
            <button
              onClick={() => disconnect()}
              className="flex items-center gap-1.5 text-gray-600 hover:text-red-400 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>

        {/* ── Desktop two-column layout ── */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* ═══════════════════════════════
                LEFT — Identity + Earnings
            ═══════════════════════════════ */}
            <div className="w-full lg:w-80 xl:w-88 shrink-0 space-y-4 lg:sticky lg:top-16 lg:self-start">

              {/* Identity card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl overflow-hidden border border-white/6"
                style={{ background: "linear-gradient(160deg,#0f0218 0%,#070110 40%,#020008 100%)" }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(220,38,38,0.07),transparent_65%)] pointer-events-none" />
                <div className="h-px w-full bg-gradient-to-r from-transparent via-red-700/50 to-transparent" />

                <div className="absolute right-0 bottom-0 w-28 h-32 pointer-events-none select-none opacity-20">
                  <Image src={Mascot} alt="" fill className="object-contain object-bottom-right" />
                </div>

                <div className="relative z-10 p-5">
                  {/* Avatar row */}
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className="w-14 h-14 rounded-2xl border border-red-800/40 flex items-center justify-center text-xl font-black text-red-300 shrink-0"
                      style={{ background: "radial-gradient(circle,#1a0218,#07020f)" }}
                    >
                      {address!.slice(2, 4).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Wallet Address</p>
                      <p className="text-sm font-bold text-white font-mono truncate">
                        {address!.slice(0, 14)}…{address!.slice(-6)}
                      </p>
                      <button
                        onClick={copyAddr}
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copied!" : "Copy full address"}
                      </button>
                    </div>
                  </div>

                  {/* G$ Balance hero */}
                  <div className="mb-4">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">G$ Balance</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-white">{gdDisplay}</span>
                      <span className="text-lg font-bold text-green-500">G$</span>
                    </div>
                  </div>

                  {/* Live game alert */}
                  {liveGames.length > 0 && (
                    <div
                      onClick={() => router.push(`/GameScreen/${liveGames[0].gameId}`)}
                      className="flex items-center gap-3 bg-green-950/30 border border-green-700/20 rounded-xl px-4 py-2.5 cursor-pointer hover:border-green-600/30 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-green-300">Active game #{liveGames[0].gameId.toString()}</p>
                        <p className="text-[10px] text-green-600">Tap to return to the table →</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
              >
                <PointsSummary
                  gamesPlayed={stats?.gamesPlayed ?? 0}
                  gamesWon={stats?.gamesWon ?? 0}
                />
              </motion.div>

              {/* ── Stats strip ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="grid grid-cols-4 rounded-2xl overflow-hidden border border-white/5"
              >
                {[
                  { label: "Played",  value: String(stats?.gamesPlayed ?? 0), sub: "games",     color: "text-white" },
                  { label: "Won",     value: String(stats?.gamesWon ?? 0),     sub: "victories", color: "text-white" },
                  { label: "Rate",    value: `${winRate}%`,                    sub: "survival",  color: "text-white" },
                  { label: "Net P&L", value: `${inProfit ? "+" : ""}${netPnl}`, sub: "G$",      color: inProfit ? "text-emerald-400" : "text-red-400" },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className={`bg-[#080812] px-2 py-4 text-center ${i < 3 ? "border-r border-white/5" : ""}`}
                  >
                    <p className="text-[8px] text-gray-600 uppercase tracking-widest mb-1">{s.label}</p>
                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[8px] text-gray-500 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </motion.div>

              {/* ── Earnings breakdown ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14 }}
                className="rounded-2xl border border-white/5 bg-[#050810] overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">Earnings Record</p>
                </div>
                {[
                  { label: "Total Staked",   value: `${totalStk} G$`, color: "text-orange-400" },
                  { label: "Total Winnings", value: `${totalWon} G$`, color: "text-emerald-400" },
                  { label: "Net Profit",     value: `${inProfit ? "+" : ""}${netPnl} G$`,
                    color: inProfit ? "text-green-400" : "text-red-400" },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                  >
                    <p className="text-xs text-gray-500">{row.label}</p>
                    <p className={`text-sm font-black ${row.color}`}>{row.value}</p>
                  </div>
                ))}
              </motion.div>

              {/* ── GoodDollar Panel (claim + identity) ── */}
              <GoodDollarPanel />

            </div>

            {/* ═══════════════════════════════
                RIGHT — Match History
            ═══════════════════════════════ */}
            <div className="flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Tab header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-black text-white tracking-wide">Match History</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{pastGames.length} recorded games</p>
                  </div>
                  <div className="flex gap-1">
                    {(["all", "won", "lost"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setHistTab(t)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          histTab === t
                            ? "bg-white/10 text-white"
                            : "text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* History list */}
                {gamesLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse" />
                    ))}
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-[#050810] px-4 py-14 text-center">
                    <p className="text-2xl mb-2">🎯</p>
                    <p className="text-sm text-gray-600">No matches in this category yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <AnimatePresence>
                      {filteredHistory.map((game, i) => {
                        const isWinner    = game.winner?.toLowerCase() === address?.toLowerCase();
                        const isCancelled = game.status === GameStatus.Cancelled;
                        const prize       = parseFloat(fmtEther(game.prizePool > 0n ? game.prizePool : game.stake)).toFixed(3);
                        const stake       = parseFloat(fmtEther(game.stake)).toFixed(3);
                        const result      = isCancelled ? "cancelled" : isWinner ? "won" : "lost";

                        const RESULT_STYLE = {
                          won:       "border-l-green-500 bg-green-950/10",
                          lost:      "border-l-white/10 bg-white/[0.02]",
                          cancelled: "border-l-red-900/50 bg-red-950/5",
                        };
                        const RESULT_LABEL = {
                          won:       <span className="text-green-400 font-black text-xs">+{prize} G$</span>,
                          lost:      <span className="text-gray-600 text-xs">-{stake} G$</span>,
                          cancelled: <span className="text-gray-700 text-xs">refunded</span>,
                        };

                        return (
                          <motion.div
                            key={game.gameId.toString()}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => router.push(`/GameScreen/${game.gameId}`)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-2 border border-white/[0.04] cursor-pointer hover:border-white/10 transition-colors ${RESULT_STYLE[result]}`}
                          >
                            <span className="text-base shrink-0">
                              {result === "won" ? "🏆" : result === "cancelled" ? "✕" : "💀"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-300">Game #{game.gameId.toString()}</p>
                              <p className="text-[10px] text-gray-600">
                                {game.playerCount} players · {game.currentRound} rounds
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {RESULT_LABEL[result]}
                              <p className="text-[9px] text-gray-700 mt-0.5">G$</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>

              {/* Footer */}
              <div className="text-center mt-8 pb-4">
                <p className="text-[10px] text-gray-500">
                  Running on{" "}
                  <a href="https://celo.org" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400 transition-colors">
                    Celo mainnet
                  </a>
                  {" "}· Stakes paid in G$ (GoodDollar)
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </BackgroundImgBlur>
  );
}
