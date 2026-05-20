"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EliminationRecord {
  name: string;
  round: number;
}

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
  // richer context for human-sounding commentary
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

export default function AICommentaryBox({
  gameId, eventTrigger, onClose,
  currentRound, activePlayers, totalPlayers, eliminatedCount, lastEliminatedAddress, prizePool,
  eventType, lastEliminatedName, winnerName, activePlayerNames, eliminationHistory,
}: AICommentaryBoxProps) {
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const isLoadingRef = useRef(false);
  const isTypingRef = useRef(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimised, setIsMinimised] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTrigger = useRef(-1);

  const fetchCommentary = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setDisplayedText("");
    setIsMinimised(false);
    try {
      const response = await fetch(
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
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch commentary");
      }
      const data = await response.json();
      const c: Commentary = {
        text: data.commentary_text,
        tensionLevel: data.tension_level,
        timestamp: data.created_at,
      };
      setCommentary(c);
      typewriterEffect(c.text);
    } catch (err: any) {
      setError(err.message || "Could not fetch commentary");
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  };

  const typewriterEffect = (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    isTypingRef.current = true;
    setIsTyping(true);
    setDisplayedText("");
    let i = 0;
    const type = () => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
        timerRef.current = setTimeout(type, 18);
      } else {
        isTypingRef.current = false;
        setIsTyping(false);
      }
    };
    type();
  };

  // Fetch when a game event fires
  useEffect(() => {
    if (gameId <= 0n) return;
    if (eventTrigger === prevTrigger.current) return;
    prevTrigger.current = eventTrigger;
    fetchCommentary();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [eventTrigger, gameId]);

  // Auto-refresh every 30 seconds so commentary stays live without user action
  useEffect(() => {
    if (gameId <= 0n) return;
    const interval = setInterval(() => {
      if (!isLoadingRef.current && !isTypingRef.current) {
        fetchCommentary();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [gameId, activePlayers, currentRound, eliminatedCount]);

  const tensionColor = (l: number) => l >= 8 ? "text-red-400" : l >= 5 ? "text-orange-400" : "text-yellow-400";
  const tensionLabel = (l: number) => l >= 9 ? "CRITICAL" : l >= 7 ? "HIGH" : l >= 5 ? "MEDIUM" : "LOW";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 22, stiffness: 200 }}
        className="fixed bottom-24 right-4 z-50 w-80 sm:w-96"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/20 to-violet-500/20 blur-xl pointer-events-none" />

        <div className="relative bg-[#0a0d1f]/95 backdrop-blur-xl border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-red-900/20">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-900/60 to-violet-900/60 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              {/* Live pulse dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <div>
                <p className="text-xs font-bold text-white tracking-wide">🎰 Russian Roulette AI</p>
                <p className="text-[10px] text-red-400">Live Game Commentary</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {commentary && !isLoading && (
                <div className="flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5">
                  <span className="text-[10px] text-gray-400">Tension:</span>
                  <span className={`text-[10px] font-bold ${tensionColor(commentary.tensionLevel)}`}>
                    {tensionLabel(commentary.tensionLevel)}
                  </span>
                </div>
              )}
              {/* Minimise */}
              <button
                onClick={() => setIsMinimised((v) => !v)}
                className="text-gray-400 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-xs"
              >
                {isMinimised ? "▲" : "▼"}
              </button>
              {/* Close */}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body — hidden when minimised */}
          {!isMinimised && (
            <div className="p-4 min-h-[90px]">
              {isLoading && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs text-gray-400 animate-pulse">Watching the game...</p>
                </div>
              )}
              {error && !isLoading && (
                <div className="text-xs text-red-400 text-center">
                  <p>⚠️ {error}</p>
                  <button onClick={fetchCommentary} className="mt-1 text-violet-300 hover:underline text-[10px]">Retry</button>
                </div>
              )}
              {!isLoading && !error && (
                <p className="text-sm text-gray-100 leading-relaxed font-light">
                  {displayedText}
                  {isTyping && <span className="inline-block w-0.5 h-4 bg-red-400 ml-0.5 animate-pulse" />}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          {!isMinimised && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-red-500/10 bg-black/20">
              <p className="text-[10px] text-gray-500">Powered by Claude Haiku 4.5</p>
              <button
                onClick={fetchCommentary}
                disabled={isLoading}
                className="text-[10px] text-red-300 hover:text-red-100 font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {isLoading ? <><span className="w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full animate-spin inline-block" /> Loading</> : "↻ Refresh"}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
