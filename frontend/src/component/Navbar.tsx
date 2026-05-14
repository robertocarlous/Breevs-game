"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Gamepad2, BarChart2, Wallet } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { useAccount } from "wagmi";

export default function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { getCurrentActiveGame } = useGameStore();

  const getGameUrl = () => {
    if (!address) return "/Home";
    const activeGame = getCurrentActiveGame(address);
    if (activeGame) return `/GameScreen/${activeGame.gameId.toString()}`;
    return "/Home";
  };

  const navItems = [
    { href: "/Home", icon: Home, label: "Home" },
    { href: getGameUrl(), icon: Gamepad2, label: "Game" },
    { href: "/LeaderBoard", icon: BarChart2, label: "Leaderboard" },
    { href: "/Wallet", icon: Wallet, label: "Wallet" },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-[#030B1F]/95 backdrop-blur-md border-t border-red-500/10 z-50">
      <div className="flex justify-around items-center py-2 px-2 max-w-screen-xl mx-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href ||
            (href.startsWith("/GameScreen/") && pathname.startsWith("/GameScreen/"));

          return (
            <Link
              key={label}
              href={href}
              className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon size={22} />
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-white" : "text-gray-500"}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-500 rounded-full shadow-sm shadow-red-500/60" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
