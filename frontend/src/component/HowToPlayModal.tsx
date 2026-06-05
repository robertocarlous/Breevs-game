"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Anton } from "next/font/google";

const anton = Anton({ subsets: ["latin"], weight: ["400"] });

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    num: "01",
    title: "Connect Your Wallet",
    body: "Use any Celo-compatible wallet — MetaMask, Valora, or WalletConnect. You need G$ to stake.",
  },
  {
    num: "02",
    title: "Enter a Game Room",
    body: "Pick an open room and stake your G$ to claim a seat, or create your own room and wait for up to 5 challengers.",
  },
  {
    num: "03",
    title: "The Wheel Spins",
    body: "Each round the creator triggers a spin. Chainlink VRF generates a tamper-proof random result on-chain — no one controls it.",
  },
  {
    num: "04",
    title: "One Falls Per Round",
    body: "The wheel lands. One player is eliminated. They leave the table. The rest advance. Repeat until two remain.",
  },
  {
    num: "05",
    title: "Last One Standing Wins",
    body: "The final survivor claims the entire prize pool — every player's stake, combined. No house cut. No fees. All G$.",
  },
];

const RULES = [
  "2 to 6 players per room",
  "Minimum stake 0.2 G$ · Maximum 5 G$",
  "Every player stakes the same amount",
  "One elimination per round, decided by on-chain randomness",
  "Prize pool equals all stakes combined",
  "Unclaimed prizes stay locked in the contract until the winner calls for them",
];

const LIVE_CHAMBER = 4;

export default function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", bounce: 0.22, duration: 0.45 }}
            className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-none bg-[#030710] border border-white/8 shadow-2xl shadow-black"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── Top accent line ── */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-600 to-transparent" />

            {/* ── Header ── */}
            <div className="px-7 pt-6 pb-5 border-b border-white/6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-red-500/70 text-[9px] font-bold uppercase tracking-[0.35em] mb-2">
                    Operation Dossier
                  </p>
                  <h2 className={`${anton.className} text-4xl text-white leading-none`}>
                    RUSSIAN
                  </h2>
                  <h2 className={`${anton.className} text-4xl text-red-500 leading-none`}>
                    ROULETTE.
                  </h2>
                  <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-2">
                    On-Chain · Celo Mainnet
                  </p>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="text-gray-600 hover:text-white transition-colors text-lg font-light mt-1 w-7 h-7 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              {/* 6-chamber visual */}
              <div className="flex items-center gap-2.5 mt-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={
                      i === LIVE_CHAMBER
                        ? {
                            scale: [1, 1.25, 1],
                            boxShadow: [
                              "0 0 0px rgba(239,68,68,0)",
                              "0 0 14px rgba(239,68,68,0.85)",
                              "0 0 5px rgba(239,68,68,0.35)",
                            ],
                          }
                        : {}
                    }
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className={`w-[14px] h-[14px] rounded-full border-2 ${
                      i === LIVE_CHAMBER
                        ? "bg-red-500 border-red-400"
                        : "bg-transparent border-gray-700"
                    }`}
                  />
                ))}
                <span className="text-gray-700 text-[9px] ml-1 uppercase tracking-widest">
                  1 live round
                </span>
              </div>
            </div>

            {/* ── Risk line ── */}
            <div className="flex items-center gap-3 px-7 py-3 border-b border-red-900/30 bg-red-950/10">
              <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse shrink-0" />
              <p className="text-red-400/80 text-[10px] uppercase tracking-widest">
                Real G$ · All transactions irreversible · Play responsibly
              </p>
            </div>

            {/* ── Steps — vertical timeline ── */}
            <div className="px-7 py-6">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-5">
                Mission Briefing
              </p>

              <div className="relative">
                {/* Vertical red thread */}
                <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-red-600/60 via-red-600/20 to-transparent" />

                <div className="space-y-6">
                  {STEPS.map((step, i) => (
                    <motion.div
                      key={step.num}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex gap-4"
                    >
                      {/* Step number circle */}
                      <div className="shrink-0 w-9 h-9 rounded-full border border-red-600/40 bg-red-950/30 flex items-center justify-center z-10">
                        <span className={`${anton.className} text-red-500 text-sm leading-none`}>
                          {step.num}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="pt-1 pb-1 flex-1">
                        <p className="text-white font-bold text-sm leading-tight">{step.title}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{step.body}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Rules ── */}
            <div className="px-7 pb-5 border-t border-white/5 pt-5">
              <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] mb-4">
                Rules of Engagement
              </p>
              <div className="space-y-2">
                {RULES.map((rule, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className={`${anton.className} text-red-600/60 text-xs shrink-0 mt-0.5`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-gray-400 text-xs leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Observer mode ── */}
            <div className="mx-7 mb-6 rounded-none border border-blue-500/15 bg-blue-950/10 px-4 py-3">
              <p className="text-[9px] text-blue-400/70 uppercase tracking-[0.3em] mb-1">Observer Mode</p>
              <p className="text-gray-400 text-xs leading-relaxed">
                No wallet, no stake — no problem. Browse all rooms and watch any live game without connecting. Step in when you are ready.
              </p>
            </div>

            {/* ── CTA ── */}
            <div className="px-7 pb-7">
              <button
                onClick={onClose}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3.5 text-xs tracking-[0.2em] uppercase transition-all shadow-[0_0_30px_rgba(220,38,38,0.25)] hover:shadow-[0_0_40px_rgba(220,38,38,0.4)]"
              >
                I understand — Let me play
              </button>
            </div>

            {/* ── Bottom accent ── */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
