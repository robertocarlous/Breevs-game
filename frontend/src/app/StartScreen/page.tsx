"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Anton, Open_Sans } from "next/font/google";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import BackgroundImg from "../../component/BackgroundImg";
import HowToPlayModal from "../../component/HowToPlayModal";
import RRLogo from "../../assets/RR_LOGO_2_1.png";
import BreevsBrand from "../../assets/BREEVS_logo_1.png";

const anton = Anton({ subsets: ["latin"], weight: ["400"] });
const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"] });

const LIVE_CHAMBER = Math.floor(Math.random() * 6);

const PHRASES = [
  { line1: "ONE",    line2: "SURVIVES.", color: "text-red-500" },
  { line1: "SIX",   line2: "ENTER.",    color: "text-orange-400" },
  { line1: "SPIN",  line2: "OR DIE.",   color: "text-red-600" },
  { line1: "ALL",   line2: "FALL.",     color: "text-amber-400" },
  { line1: "NO",    line2: "MERCY.",    color: "text-rose-500" },
];

export default function StartScreen() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <BackgroundImg>
      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 sm:px-10 py-5">
        <Image
          src={BreevsBrand}
          alt="Breevs"
          className="w-14 sm:w-16"
          style={{ filter: "brightness(3) grayscale(0.3)" }}
        />
        <button
          onClick={() => setShowHowToPlay(true)}
          className="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-[0.25em] transition-colors"
        >
          How to Play
        </button>
      </div>

      {/* Centred content */}
      <div className={`${openSans.className} flex flex-col items-center text-center px-6 py-24 w-full max-w-xl mx-auto`}>

        {/* RR Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="mb-6"
        >
          <Image src={RRLogo} alt="Russian Roulette" className="w-40 sm:w-52 mx-auto opacity-90" />
        </motion.div>

        {/* Live badge */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="text-red-500/80 text-[10px] font-bold uppercase tracking-[0.35em] mb-5 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Live on Celo Mainnet
        </motion.p>

        {/* Hero type — cycling phrases */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative h-[172px] sm:h-[232px] flex flex-col items-center justify-center mb-5 overflow-hidden"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={phraseIdx}
              initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -32, filter: "blur(6px)" }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="flex flex-col items-center"
            >
              <h1 className={`${anton.className} text-[78px] sm:text-[108px] leading-[0.88] text-white`}>
                {PHRASES[phraseIdx].line1}
              </h1>
              <h1 className={`${anton.className} text-[78px] sm:text-[108px] leading-[0.88] ${PHRASES[phraseIdx].color}`}>
                {PHRASES[phraseIdx].line2}
              </h1>
            </motion.div>
          </AnimatePresence>

          {/* Phrase dots */}
          <div className="absolute bottom-0 flex items-center gap-1.5">
            {PHRASES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhraseIdx(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === phraseIdx ? "w-4 h-1.5 bg-red-500" : "w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* 6-chamber visual */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.28 }}
          className="flex items-center justify-center gap-3 my-6"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              animate={
                i === LIVE_CHAMBER
                  ? {
                      scale: [1, 1.25, 1],
                      boxShadow: [
                        "0 0 0px rgba(239,68,68,0)",
                        "0 0 18px rgba(239,68,68,0.9)",
                        "0 0 6px rgba(239,68,68,0.4)",
                      ],
                    }
                  : {}
              }
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className={`w-[18px] h-[18px] rounded-full border-2 ${
                i === LIVE_CHAMBER
                  ? "bg-red-500 border-red-400"
                  : "bg-transparent border-gray-600"
              }`}
            />
          ))}
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm mb-2"
        >
          Six players enter. Chainlink VRF spins the chamber. One eliminated each round. The last survivor takes everything.
        </motion.p>

        {/* Inline stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42 }}
          className="flex items-center justify-center gap-4 mt-3 mb-8 text-[11px] uppercase tracking-widest"
        >
          <span>
            <span className="text-white font-black">6</span>
            <span className="text-gray-600 ml-1">max</span>
          </span>
          <span className="text-gray-500">·</span>
          <span>
            <span className="text-white font-black">0.2 CELO</span>
            <span className="text-gray-600 ml-1">min</span>
          </span>
          <span className="text-gray-500">·</span>
          <span>
            <span className="text-white font-black">100%</span>
            <span className="text-gray-600 ml-1">to winner</span>
          </span>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
          className="flex flex-col sm:flex-row gap-3 w-full max-w-xs"
        >
          {isConnected ? (
            <button
              onClick={() => router.push("/Home")}
              className="group flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 text-xs tracking-[0.2em] uppercase transition-all duration-200 shadow-[0_0_40px_rgba(220,38,38,0.35)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)]"
            >
              Enter the Room
              <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
            </button>
          ) : (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) =>
                mounted ? (
                  <button
                    onClick={openConnectModal}
                    className="group flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 text-xs tracking-[0.2em] uppercase transition-all duration-200 shadow-[0_0_40px_rgba(220,38,38,0.35)] hover:shadow-[0_0_60px_rgba(220,38,38,0.5)]"
                  >
                    Connect and Play
                    <span className="ml-2 group-hover:translate-x-1 inline-block transition-transform">→</span>
                  </button>
                ) : null
              }
            </ConnectButton.Custom>
          )}

          <button
            onClick={() => router.push("/Home")}
            className="flex-1 border border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 font-bold py-4 text-xs tracking-[0.2em] uppercase transition-all duration-200"
          >
            Watch Live
          </button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={() => setShowHowToPlay(true)}
          className="mt-5 text-gray-500 hover:text-gray-300 text-[10px] uppercase tracking-[0.25em] transition-colors"
        >
          How it works ↓
        </motion.button>
      </div>

      {/* Bottom brand line */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <p className="text-gray-500 text-[10px] uppercase tracking-widest">
          Provably fair · Chainlink VRF · Product of Breevs
        </p>
      </div>
    </BackgroundImg>
  );
}
