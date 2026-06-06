"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { computePoints, pointsBreakdown, POINTS_PER_GAME, POINTS_PER_WIN } from "@/lib/points";

interface PointsSummaryProps {
  gamesPlayed: number;
  gamesWon: number;
  compact?: boolean;
}

export default function PointsSummary({ gamesPlayed, gamesWon, compact = false }: PointsSummaryProps) {
  const points = computePoints(gamesPlayed, gamesWon);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-sm font-black text-amber-300">{points.toLocaleString()}</span>
        <span className="text-[10px] text-gray-600">pts</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-500/20 overflow-hidden"
      style={{ background: "linear-gradient(135deg,#1a1208 0%,#0a0806 100%)" }}
    >
      <div className="px-4 py-3 border-b border-amber-500/10 flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[9px] text-amber-500/80 uppercase tracking-[0.3em] font-bold">Reward Points</span>
      </div>

      <div className="px-4 py-4">
        <p className="text-3xl font-black text-amber-300 leading-none">{points.toLocaleString()}</p>
        <p className="text-[10px] text-gray-600 mt-1.5">{pointsBreakdown(gamesPlayed, gamesWon)}</p>
        <p className="text-[9px] text-gray-700 mt-2 leading-relaxed">
          {POINTS_PER_GAME} pts per game · {POINTS_PER_WIN} pts per win
        </p>
      </div>
    </motion.div>
  );
}
