"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EliminationRecord { name: string; round: number; }

interface AICommentaryBoxProps {
  gameId: bigint;
  eventTrigger: number;
  onClose: () => void;
  currentRound?: number;
  activePlayers?: number;
  totalPlayers?: number;
  eliminatedCount?: number;
  lastEliminatedAddress?: string | null;
  prizePool?: string;
  eventType?: string;
  lastEliminatedName?: string | null;
  winnerName?: string | null;
  activePlayerNames?: string[];
  eliminationHistory?: EliminationRecord[];
}

interface Commentary {
  text: string;
  tensionLevel: number;
  timestamp: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const TENSION_CONFIG = [
  { min: 9, label: "CRITICAL", color: "#ff3020", bar: "#ff4030", glow: "rgba(255,48,32,0.4)" },
  { min: 7, label: "HIGH",     color: "#e05020", bar: "#e06030", glow: "rgba(220,80,40,0.3)" },
  { min: 5, label: "MEDIUM",   color: "#c07830", bar: "#c08840", glow: "rgba(180,120,40,0.25)" },
  { min: 0, label: "LOW",      color: "#808878", bar: "#909888", glow: "rgba(120,130,100,0.15)" },
] as const;

function getTension(level: number) {
  return TENSION_CONFIG.find(t => level >= t.min) ?? TENSION_CONFIG[3];
}

export default function AICommentaryBox({
  gameId, eventTrigger, onClose,
  currentRound, activePlayers, totalPlayers, eliminatedCount, lastEliminatedAddress, prizePool,
  eventType, lastEliminatedName, winnerName, activePlayerNames, eliminationHistory,
}: AICommentaryBoxProps) {
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimised, setIsMinimised] = useState(false);

  const isLoadingRef = useRef(false);
  const isTypingRef  = useRef(false);
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef   = useRef(0);
  const prevTrigger  = useRef(-1);

  const fetchCommentary = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setDisplayedText("");
    setIsMinimised(false);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/games/${gameId.toString()}/generate_live_commentary/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            current_round: currentRound,
            active_players: activePlayers,
            total_players: totalPlayers ?? 6,
            eliminated_count: eliminatedCount ?? 0,
            last_eliminated_address: lastEliminatedAddress ?? null,
            prize_pool: prizePool ?? null,
            event_type: eventType ?? "generic",
            last_eliminated_name: lastEliminatedName ?? null,
            winner_name: winnerName ?? null,
            active_player_names: activePlayerNames ?? [],
            elimination_history: eliminationHistory ?? [],
          }),
        }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const d = await res.json();
      const c: Commentary = { text: d.commentary_text, tensionLevel: d.tension_level, timestamp: d.created_at };
      setCommentary(c);
      typewriter(c.text);
    } catch (err: any) {
      setError(err.message || "No signal");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const typewriter = (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const session = ++sessionRef.current;
    isTypingRef.current = true;
    setIsTyping(true);
    setDisplayedText("");
    let i = 0;
    const tick = () => {
      if (sessionRef.current !== session) return;
      if (i < text.length) {
        setDisplayedText(p => p + text.charAt(i++));
        timerRef.current = setTimeout(tick, 16);
      } else {
        isTypingRef.current = false;
        setIsTyping(false);
      }
    };
    tick();
  };

  useEffect(() => {
    if (gameId <= 0n || eventTrigger === prevTrigger.current) return;
    prevTrigger.current = eventTrigger;
    fetchCommentary();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [eventTrigger, gameId]);

  useEffect(() => {
    if (gameId <= 0n) return;
    const id = setInterval(() => {
      if (!isLoadingRef.current && !isTypingRef.current) fetchCommentary();
    }, 30000);
    return () => clearInterval(id);
  }, [gameId, activePlayers, currentRound, eliminatedCount]);

  const tension = commentary ? getTension(commentary.tensionLevel) : null;
  const tensionPct = commentary ? Math.round((commentary.tensionLevel / 10) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        className="fixed bottom-6 right-4 z-50 w-[340px] sm:w-[380px]"
      >
        {/* Outer broadcast frame */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            background: "linear-gradient(170deg, rgba(8,6,4,0.98) 0%, rgba(12,9,6,0.99) 100%)",
            border: "1px solid rgba(100,70,30,0.35)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* ── Header — broadcast chyron style ── */}
          <div
            className="flex items-center justify-between px-3 py-2 relative"
            style={{
              background: "linear-gradient(to right, rgba(18,10,6,0.98), rgba(22,13,7,0.98))",
              borderBottom: "1px solid rgba(100,65,25,0.25)",
            }}
          >
            {/* Left: LIVE badge + title */}
            <div className="flex items-center gap-2.5">
              {/* LIVE dot */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#dc3020" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#ff3828" }} />
                </span>
                <span
                  className="text-[9px] font-black tracking-[0.2em] px-1.5 py-0.5 rounded"
                  style={{ background: "#dc2010", color: "white", letterSpacing: "0.15em" }}
                >
                  LIVE
                </span>
              </div>

              <div>
                <p className="text-[11px] font-black text-stone-200 tracking-wide leading-none">BREEVS ROULETTE</p>
                <p className="text-[9px] text-stone-600 leading-none mt-0.5">
                  {currentRound ? `Round ${currentRound}` : "Pre-game"} · {activePlayers ?? "?"} alive
                </p>
              </div>
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimised(v => !v)}
                className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:text-stone-400 transition-colors text-[10px]"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {isMinimised ? "▲" : "▼"}
              </button>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:text-stone-300 transition-colors text-xs"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <AnimatePresence>
            {!isMinimised && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Commentary text area */}
                <div className="px-4 py-3 min-h-[80px]">
                  {isLoading && (
                    <div className="flex items-center gap-2.5 py-2">
                      {/* Broadcast "loading" bars */}
                      <div className="flex gap-0.5 items-end h-5 shrink-0">
                        {[0.6, 1, 0.7, 0.9, 0.5].map((h, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-sm animate-pulse"
                            style={{
                              height: `${h * 20}px`,
                              background: "#a05828",
                              animationDelay: `${i * 0.1}s`,
                              opacity: 0.7,
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-stone-600 italic">Commentator is watching…</p>
                    </div>
                  )}

                  {error && !isLoading && (
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-stone-600 text-xs">📡 No signal —</span>
                      <button
                        onClick={fetchCommentary}
                        className="text-xs font-bold transition-colors"
                        style={{ color: "#a06030" }}
                      >
                        Reconnect
                      </button>
                    </div>
                  )}

                  {!isLoading && !error && (
                    <p className="text-sm text-stone-300 leading-relaxed font-light">
                      {displayedText}
                      {isTyping && (
                        <span
                          className="inline-block w-0.5 h-[14px] ml-0.5 align-middle animate-pulse"
                          style={{ background: "#a06030" }}
                        />
                      )}
                    </p>
                  )}
                </div>

                {/* ── Tension meter ── */}
                {commentary && !isLoading && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] uppercase tracking-[0.15em] text-stone-700 font-bold">Tension</p>
                      <p
                        className="text-[9px] font-black tracking-[0.12em]"
                        style={{ color: tension!.color }}
                      >
                        {tension!.label}
                      </p>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${tensionPct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{
                          background: `linear-gradient(to right, ${tension!.bar}88, ${tension!.bar})`,
                          boxShadow: `0 0 8px ${tension!.glow}`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Footer strip ── */}
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{
                    borderTop: "1px solid rgba(80,55,25,0.2)",
                    background: "rgba(6,4,3,0.6)",
                  }}
                >
                  <p className="text-[9px] text-stone-700">Claude Haiku 4.5</p>
                  <button
                    onClick={fetchCommentary}
                    disabled={isLoading}
                    className="text-[9px] font-bold transition-all disabled:opacity-40 flex items-center gap-1"
                    style={{ color: "#806030" }}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-2 h-2 border border-stone-600 border-t-transparent rounded-full animate-spin inline-block" />
                        Live…
                      </>
                    ) : "↻ Refresh"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
