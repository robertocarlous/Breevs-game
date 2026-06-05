"use client";

import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GameStatus, GameInfo, MIN_STAKE } from "@/lib/contractCalls";
import { formatEther } from "viem";
import { useIsGameCreator } from "@/hooks/useGame";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useAccount } from "wagmi";
import { showErrorToast } from "@/component/Toast";
import RRLogo from "@/assets/RR_LOGO_2_1.png";

// 6 chamber positions around a circle, starting from top
const CHAMBER_POSITIONS = Array.from({ length: 6 }, (_, i) => {
  const angle = (-90 + i * 60) * (Math.PI / 180);
  return {
    cx: parseFloat((60 + 36 * Math.cos(angle)).toFixed(2)),
    cy: parseFloat((60 + 36 * Math.sin(angle)).toFixed(2)),
  };
});

interface GameCardProps {
  game: GameInfo;
  error?: string;
  clearError?: () => void;
  onClick?: () => void;
}

export default function GameCard({ game, error, clearError, onClick }: GameCardProps) {
  const router = useRouter();
  const { address } = useAccount();
  const { hasActiveGame, getCurrentActiveGame, setSelectedGame } = useGameStore();
  const { data: isGameCreator } = useIsGameCreator(
    address ? game.gameId : 0n,
    address || ""
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shimmer, setShimmer] = useState({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);

  const isUserGame = address
    ? game.players.map((p) => p.toLowerCase()).includes(address.toLowerCase())
    : false;

  const isEnded = game.status === GameStatus.Ended;
  const isCancelled = game.status === GameStatus.Cancelled;
  const isInactive = isEnded || isCancelled;
  const isInProgress = game.status === GameStatus.InProgress;

  const isJoinDisabled = address
    ? hasActiveGame(address) && !isUserGame && !isGameCreator && !isInactive
    : false;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isJoinDisabled) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: -((e.clientY - cy) / (rect.height / 2)) * 18,
      y: ((e.clientX - cx) / (rect.width / 2)) * 18,
    });
    setShimmer({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [isJoinDisabled]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setTilt({ x: 0, y: 0 });
    setShimmer({ x: 50, y: 50 });
  }, []);

  const handleAction = async () => {
    if (!address) {
      if (game.status !== GameStatus.Active) {
        router.push(`/GameScreen/${game.gameId.toString()}`);
      } else if (onClick) {
        onClick();
      }
      return;
    }
    if (isJoinDisabled) {
      const activeGame = getCurrentActiveGame(address);
      if (activeGame) {
        showErrorToast(`You are already in game #${activeGame.gameId}. Finish it first.`, "Active Game");
        router.push(`/GameScreen/${activeGame.gameId.toString()}`);
      }
      return;
    }
    if (isGameCreator || isUserGame || game.status !== GameStatus.Active) {
      router.push(`/GameScreen/${game.gameId.toString()}`);
    } else {
      setSelectedGame(game);
      if (onClick) onClick();
    }
  };

  const shortAddr = (a: string) =>
    a?.startsWith("0x") ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Unknown";

  const stakeEth = formatEther(game.stake > 0n ? game.stake : MIN_STAKE);
  const prizeEth = formatEther(game.prizePool > 0n ? game.prizePool : game.stake > 0n ? game.stake : MIN_STAKE);
  const shortWinner = game.winner?.startsWith("0x") ? shortAddr(game.winner) : null;
  const playerCount = Number(game.playerCount);

  // ── Brand accent colour (rgb) per status ─────────────────────────
  const [sr, sg, sb] = (
    isCancelled   ? "80,88,110"    :  // muted slate
    isEnded       ? "65,140,210"   :  // steel blue — resolved
    isInProgress  ? "215,120,20"   :  // vivid amber — live
    isGameCreator ? "190,160,35"   :  // gold — host
                    "210,38,38"       // brand red — open
  ).split(",").map(Number);

  // Navy base used in all card backgrounds
  const NAVY = "linear-gradient(160deg, #0C1440 0%, #070A1C 50%, #080C22 100%)";

  const T = (() => {
    if (isCancelled) return {
      bg:            "linear-gradient(160deg, #070912 0%, #050709 100%)",
      glowColor:     "rgba(80,88,110,0.12)",
      badge:         "text-slate-500 border-slate-700/30 bg-slate-900/20",
      dot:           "bg-slate-600",
      label:         "Cancelled",
      priceColor:    "#5a6070",
      noteColor:     "#40464e",
      chamberFill:   "rgba(18,20,30,0.92)",
      chamberStroke: "rgba(65,70,90,0.30)",
      bulletFill:    "rgba(65,70,90,0.55)",
      ctaBg:         "bg-white/5 hover:bg-white/8 text-slate-500",
      ctaText:       "View",
      logoOpacity:   "opacity-10 grayscale",
    };
    if (isEnded) return {
      bg:            "linear-gradient(160deg, #090E22 0%, #060A1A 55%, #070C1E 100%)",
      glowColor:     "rgba(65,140,210,0.25)",
      badge:         "text-sky-400/80 border-sky-700/30 bg-sky-950/20",
      dot:           "bg-sky-400",
      label:         "Ended",
      priceColor:    "#5aabdc",
      noteColor:     "#3a8abf",
      chamberFill:   "rgba(8,14,32,0.90)",
      chamberStroke: "rgba(65,140,210,0.52)",
      bulletFill:    "rgba(65,140,210,0.88)",
      ctaBg:         "bg-sky-950/25 hover:bg-sky-900/35 text-sky-400",
      ctaText:       "View Result",
      logoOpacity:   "opacity-25",
    };
    if (isInProgress) return {
      bg:            "linear-gradient(160deg, #0A0E22 0%, #07091C 55%, #080B1E 100%)",
      glowColor:     "rgba(215,120,20,0.28)",
      badge:         "text-amber-400/80 border-amber-700/30 bg-amber-950/15",
      dot:           "bg-amber-400 animate-pulse",
      label:         isGameCreator ? "Your Game" : "In Progress",
      priceColor:    "#d07818",
      noteColor:     "#c09030",
      chamberFill:   "rgba(12,10,6,0.92)",
      chamberStroke: "rgba(215,120,20,0.58)",
      bulletFill:    "rgba(215,120,20,0.92)",
      ctaBg:         "bg-amber-950/20 hover:bg-amber-900/30 text-amber-400",
      ctaText:       isGameCreator ? "Manage" : isUserGame ? "Rejoin" : "Watch",
      logoOpacity:   "opacity-25",
    };
    const host = !!isGameCreator;
    return {
      bg:            NAVY,
      glowColor:     host ? "rgba(190,160,35,0.30)" : "rgba(210,38,38,0.35)",
      badge:         host
        ? "text-amber-400/80 border-amber-700/30 bg-amber-950/15"
        : "text-red-400/80 border-red-700/30 bg-red-950/15",
      dot:           host ? "bg-amber-400" : "bg-red-400 animate-pulse",
      label:         host ? "HOST" : "OPEN",
      priceColor:    host ? "#c8a820" : "#e02828",
      noteColor:     host ? "#a08818" : "#e05050",
      chamberFill:   host ? "rgba(20,16,4,0.92)"   : "rgba(28,5,8,0.92)",
      chamberStroke: host ? "rgba(190,160,35,0.65)" : "rgba(210,38,38,0.72)",
      bulletFill:    host ? "rgba(190,160,35,0.96)" : "rgba(210,38,38,0.98)",
      ctaBg: host
        ? "bg-amber-950/20 hover:bg-amber-900/30 text-amber-400"
        : isUserGame
        ? "bg-sky-950/20 hover:bg-sky-900/30 text-sky-400"
        : !address
        ? "bg-white/5 hover:bg-white/8 text-slate-400 border border-white/8"
        : "bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-lg shadow-red-900/40",
      ctaText: host ? "Manage" : isUserGame ? "Rejoin" : !address ? "Connect to Join" : "Join Game",
      logoOpacity: "opacity-30",
    };
  })();

  const is3D = hovered && !isJoinDisabled;
  const maxTilt = 22;
  const lightAngle = 135 + (tilt.y / maxTilt) * 45 - (tilt.x / maxTilt) * 32;
  const lightIntensity = Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y) / maxTilt;
  const shadowX = is3D ? tilt.y * 2.8 : 0;
  const shadowY = is3D ? -tilt.x * 2.8 + 28 : 8;

  const cardTransform = is3D
    ? `perspective(460px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(46px) translateY(-14px) scale(1.05)`
    : "perspective(460px) rotateX(0deg) rotateY(0deg) translateZ(0px) translateY(0px) scale(1)";

  const outerGlow = is3D
    ? `${shadowX}px ${shadowY}px 90px rgba(0,0,0,0.96),
       ${shadowX * 0.4}px ${shadowY * 0.4}px 32px rgba(0,0,0,0.80),
       0 0 60px ${T.glowColor},
       0 0 140px rgba(${sr},${sg},${sb},0.07)`
    : `0px 8px 40px rgba(0,0,0,0.80), 0 0 18px ${T.glowColor}`;

  // Border: accent colour woven with brand navy — gives a metallic two-tone frame
  const borderGradient = isInactive
    ? `linear-gradient(135deg,
        rgba(50,58,95,0.30) 0%,
        rgba(30,38,72,0.08) 40%,
        rgba(50,58,95,0.24) 100%
      )`
    : `linear-gradient(135deg,
        rgba(${sr},${sg},${sb},0.95) 0%,
        rgba(11,20,69,0.65)          12%,
        rgba(${sr},${sg},${sb},0.65) 26%,
        rgba(5,10,28,1.00)           46%,
        rgba(${sr},${sg},${sb},0.65) 64%,
        rgba(11,20,69,0.65)          80%,
        rgba(${sr},${sg},${sb},0.95) 100%
      )`;

  const corners = [
    { top: -1, left: -1 },
    { top: -1, right: -1 },
    { bottom: -1, left: -1 },
    { bottom: -1, right: -1 },
  ];

  // Prize font size adapts to string length
  const prizeFontSize = prizeEth.length > 5 ? "9" : prizeEth.length > 3 ? "12" : "15";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: "460px", transformStyle: "preserve-3d" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        whileTap={{ scale: isJoinDisabled ? 1 : 0.96 }}
        onClick={handleAction}
        style={{
          transform: cardTransform,
          boxShadow: outerGlow,
          background: borderGradient,
          padding: is3D ? "3px" : "2.5px",
          transition: "transform 0.14s cubic-bezier(0.23,1,0.32,1), box-shadow 0.14s ease, padding 0.14s ease",
        }}
        className={`relative rounded-[20px] cursor-pointer ${isJoinDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {/* Corner gems */}
        {corners.map((pos, i) => (
          <div
            key={i}
            className="absolute z-40 pointer-events-none card-corner-gem"
            style={{
              ...pos,
              width: 12,
              height: 12,
              backgroundColor: T.priceColor,
              transform: "rotate(45deg)",
              opacity: isInactive ? 0.15 : 0.80,
              boxShadow: `0 0 8px ${T.priceColor}BB, 0 0 18px ${T.priceColor}44`,
              border: `1px solid rgba(255,255,255,0.20)`,
            }}
          />
        ))}

        {/* Inner card */}
        <div
          className="relative rounded-[17px] overflow-hidden h-full"
          style={{ background: T.bg }}
        >
          {/* Subtle dot-grid — premium card texture */}
          <div
            className="absolute inset-0 pointer-events-none z-[0]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)`,
              backgroundSize: "18px 18px",
              opacity: isInactive ? 0.35 : 0.7,
            }}
          />

          {/* Directional lighting */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background: `linear-gradient(${lightAngle}deg,
                rgba(255,255,255,${is3D ? 0.07 + lightIntensity * 0.09 : 0.035}) 0%,
                transparent 45%,
                rgba(0,0,0,${is3D ? 0.07 + lightIntensity * 0.06 : 0.025}) 100%
              )`,
              transition: "background 0.07s ease",
            }}
          />

          {/* Shimmer + specular + holo on hover */}
          {is3D && (
            <>
              {/* Holographic foil sweep */}
              <div className="absolute inset-0 z-[2] pointer-events-none card-holo" />
              {/* Radial cursor shimmer */}
              <div
                className="absolute inset-0 z-[3] pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse 60% 50% at ${shimmer.x}% ${shimmer.y}%,
                    rgba(255,255,255,0.12) 0%, rgba(${sr},${sg},${sb},0.06) 40%, transparent 70%)`,
                  mixBlendMode: "screen",
                }}
              />
              {/* Specular hot-spot */}
              <div
                className="absolute pointer-events-none z-[4]"
                style={{
                  width: 90, height: 90, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 45%, transparent 70%)",
                  left: `calc(${shimmer.x}% - 45px)`,
                  top: `calc(${shimmer.y}% - 45px)`,
                  mixBlendMode: "screen",
                }}
              />
            </>
          )}

          {/* Brand red top stripe — always visible identity mark */}
          <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none z-[5]"
            style={{ background: "linear-gradient(to right, transparent 6%, rgba(200,35,35,0.95) 26%, rgba(220,48,48,1) 50%, rgba(200,35,35,0.95) 74%, transparent 94%)" }}
          />

          {/* Status-tinted top edge (sits above the red stripe, subtle) */}
          <div className="absolute top-[2px] left-0 right-0 h-px pointer-events-none z-[5]"
            style={{ background: `linear-gradient(to right, transparent, rgba(${sr},${sg},${sb},${is3D ? 0.5 : 0.18}), transparent)` }}
          />

          {/* Disabled overlay */}
          {isJoinDisabled && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-[1px]">
              <p className="text-[10px] text-white/50 text-center px-4">Finish your active game first</p>
            </div>
          )}

          <div className="relative z-10 flex flex-col gap-2.5 p-3.5">

            {/* ── Header: Logo + ID + Status badge ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`relative w-8 h-4 shrink-0 ${T.logoOpacity}`}>
                  <Image src={RRLogo} alt="RR" fill className="object-contain object-left" />
                </div>
                <span className="text-[9px] font-bold font-mono text-gray-700 tracking-widest">
                  #{game.gameId.toString()}
                </span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-bold tracking-wider ${T.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${T.dot}`} />
                {T.label}
              </div>
            </div>

            {/* ── Revolver chamber SVG ── */}
            <div
              className="relative w-full"
              style={{
                transform: is3D ? "translateZ(14px)" : "translateZ(0px)",
                transition: "transform 0.16s ease",
                filter: is3D
                  ? `drop-shadow(0 0 14px rgba(${sr},${sg},${sb},0.35))`
                  : `drop-shadow(0 0 5px rgba(${sr},${sg},${sb},0.15))`,
              }}
            >
              <svg viewBox="0 0 120 120" className="w-full">
                {/* Outer bezel ring */}
                <circle cx="60" cy="60" r="57"
                  fill={`rgba(${sr},${sg},${sb},0.03)`}
                  stroke={`rgba(${sr},${sg},${sb},0.22)`}
                  strokeWidth="1.5"
                />
                {/* Bezel accent ring */}
                <circle cx="60" cy="60" r="52"
                  fill="none"
                  stroke={`rgba(${sr},${sg},${sb},0.08)`}
                  strokeWidth="0.5"
                />
                {/* Cylinder body */}
                <circle cx="60" cy="60" r="46"
                  fill="rgba(0,0,0,0.55)"
                  stroke={`rgba(${sr},${sg},${sb},0.14)`}
                  strokeWidth="1"
                />

                {/* Rifling grooves — subtle radial lines */}
                {Array.from({ length: 12 }, (_, i) => {
                  const a = ((i * 30) - 90) * (Math.PI / 180);
                  return (
                    <line key={i}
                      x1={(60 + 24 * Math.cos(a)).toFixed(2)}
                      y1={(60 + 24 * Math.sin(a)).toFixed(2)}
                      x2={(60 + 45 * Math.cos(a)).toFixed(2)}
                      y2={(60 + 45 * Math.sin(a)).toFixed(2)}
                      stroke={`rgba(${sr},${sg},${sb},0.055)`}
                      strokeWidth="0.6"
                    />
                  );
                })}

                {/* 6 Chambers — rotate on hover */}
                <g className={is3D && !isInactive ? "cylinder-spinning" : "cylinder-idle"}>
                  {CHAMBER_POSITIONS.map((pos, i) => {
                    const filled = i < playerCount;
                    const isWinChamber = isEnded && filled && i === 0;
                    return (
                      <g key={i}>
                        {/* Outer glow for loaded chamber */}
                        {filled && !isCancelled && (
                          <circle
                            cx={pos.cx} cy={pos.cy} r="13"
                            fill={`rgba(${sr},${sg},${sb},0.10)`}
                          />
                        )}
                        {/* Chamber hole */}
                        <circle
                          cx={pos.cx} cy={pos.cy} r="10"
                          fill={filled ? T.chamberFill : "rgba(6,7,14,0.95)"}
                          stroke={filled ? T.chamberStroke : "rgba(45,48,65,0.30)"}
                          strokeWidth={filled ? "1.8" : "1"}
                        />
                        {/* Bullet (loaded chamber) */}
                        {filled && (
                          <>
                            <circle cx={pos.cx} cy={pos.cy} r="5.5"
                              fill={T.bulletFill}
                            />
                            {/* Primer dot */}
                            <circle cx={pos.cx} cy={pos.cy} r="2"
                              fill={isWinChamber ? "#ffd700" : "rgba(255,255,255,0.55)"}
                            />
                          </>
                        )}
                        {/* Empty chamber cross-hairs */}
                        {!filled && (
                          <>
                            <line
                              x1={pos.cx - 4} y1={pos.cy}
                              x2={pos.cx + 4} y2={pos.cy}
                              stroke="rgba(45,48,65,0.25)" strokeWidth="0.8"
                            />
                            <line
                              x1={pos.cx} y1={pos.cy - 4}
                              x2={pos.cx} y2={pos.cy + 4}
                              stroke="rgba(45,48,65,0.25)" strokeWidth="0.8"
                            />
                          </>
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* Center bore */}
                <circle cx="60" cy="60" r="22"
                  fill="rgba(0,0,0,0.92)"
                  stroke={`rgba(${sr},${sg},${sb},0.18)`}
                  strokeWidth="1"
                />
                <circle cx="60" cy="60" r="17"
                  fill="rgba(0,0,0,0.96)"
                  stroke={`rgba(${sr},${sg},${sb},0.08)`}
                  strokeWidth="0.5"
                />

                {/* Center content */}
                {isEnded && shortWinner ? (
                  <>
                    <text x="60" y="55" textAnchor="middle" fontSize="6"
                      fill={`rgba(${sr},${sg},${sb},0.7)`} fontWeight="bold" letterSpacing="0.5">WIN</text>
                    <text x="60" y="65" textAnchor="middle" fontSize={prizeFontSize}
                      fill={T.priceColor} fontWeight="900">{prizeEth}</text>
                    <text x="60" y="73" textAnchor="middle" fontSize="5.5"
                      fill={T.noteColor} fontWeight="bold">G$</text>
                  </>
                ) : isCancelled ? (
                  <>
                    <text x="60" y="58" textAnchor="middle" fontSize="6"
                      fill="rgba(60,65,80,0.6)" fontWeight="bold">VOID</text>
                    <text x="60" y="68" textAnchor="middle" fontSize="9"
                      fill="rgba(50,55,70,0.5)" fontWeight="900"
                      style={{ textDecoration: "line-through" }}>{stakeEth}</text>
                  </>
                ) : (
                  <>
                    <text x="60" y="52" textAnchor="middle" fontSize="5.5"
                      fill={`rgba(${sr},${sg},${sb},0.55)`} letterSpacing="0.8">PRIZE</text>
                    <text x="60" y="64" textAnchor="middle" fontSize={prizeFontSize}
                      fill={T.priceColor} fontWeight="900">{prizeEth}</text>
                    <text x="60" y="73" textAnchor="middle" fontSize="5.5"
                      fill={T.noteColor} fontWeight="bold" letterSpacing="0.5">G$</text>
                  </>
                )}
              </svg>
            </div>

            {/* ── Divider ── */}
            <div className="h-px w-full"
              style={{ background: `linear-gradient(to right, transparent, rgba(${sr},${sg},${sb},0.20), transparent)` }}
            />

            {/* ── Stats row ── */}
            <div
              className="grid grid-cols-3 gap-1.5"
              style={{
                transform: is3D ? "translateZ(7px)" : "translateZ(0px)",
                transition: "transform 0.16s ease",
              }}
            >
              {[
                { label: "Stake", value: stakeEth },
                { label: "Players", value: `${playerCount}/6` },
                { label: "Round", value: game.currentRound > 0 ? String(game.currentRound) : "—" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-1.5 text-center"
                  style={{
                    background: `rgba(${sr},${sg},${sb},0.06)`,
                    border: `1px solid rgba(${sr},${sg},${sb},0.13)`,
                  }}
                >
                  <p className="text-[7px] text-gray-600 uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-[11px] font-bold text-gray-300">{value}</p>
                </div>
              ))}
            </div>

            {/* ── Creator + CTA ── */}
            <div className="flex items-center gap-2 px-0.5">
              <div
                className="w-4 h-4 rounded-full border flex items-center justify-center text-[7px] font-bold text-gray-500 shrink-0"
                style={{
                  background: `rgba(${sr},${sg},${sb},0.12)`,
                  borderColor: `rgba(${sr},${sg},${sb},0.18)`,
                }}
              >
                {shortAddr(game.creator).slice(2, 4).toUpperCase()}
              </div>
              <p className="text-[8px] text-gray-700 font-mono truncate flex-1">{shortAddr(game.creator)}</p>
            </div>

            <button
              className={`w-full py-2 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-200 ${T.ctaBg}`}
              style={{
                transform: is3D ? "translateZ(12px)" : "translateZ(0px)",
                transition: "transform 0.16s ease",
              }}
              onClick={(e) => { e.stopPropagation(); handleAction(); }}
            >
              {T.ctaText}
            </button>

            {error && clearError && (
              <div className="p-2 bg-red-950/40 border border-red-900/30 rounded-lg flex gap-2 items-start">
                <p className="text-xs text-red-400 flex-1">{error}</p>
                <button onClick={(e) => { e.stopPropagation(); clearError(); }} className="text-red-500 hover:text-white">×</button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
