"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  duration: number;
  wobble: number;
}

const COLORS = [
  "#FF3B3B", "#FFD700", "#00FF88", "#FF88FF", "#00CFFF",
  "#FF6B00", "#FFFFFF", "#FF3B3B", "#FFD700", "#00FF88",
];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.8,
    size: Math.random() * 8 + 5,
    duration: Math.random() * 1.5 + 2,
    wobble: (Math.random() - 0.5) * 200,
  }));
}

interface ConfettiProps {
  active: boolean;
  count?: number;
}

export default function Confetti({ active, count = 80 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) setParticles(makeParticles(count));
    else setParticles([]);
  }, [active, count]);

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[998] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
              animate={{
                y: "110vh",
                x: `calc(${p.x}vw + ${p.wobble}px)`,
                opacity: [1, 1, 0.7, 0],
                rotate: Math.random() > 0.5 ? 540 : -540,
                scale: [1, 1.2, 0.8, 1],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "easeIn",
              }}
              style={{
                position: "absolute",
                top: 0,
                width: p.size,
                height: p.size * (Math.random() > 0.5 ? 1 : 2.5),
                backgroundColor: p.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                boxShadow: `0 0 6px ${p.color}`,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
