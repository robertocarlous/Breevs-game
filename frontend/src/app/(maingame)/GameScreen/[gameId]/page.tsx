"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import WheelOfFortune from "@/component/WheelOfFortune";
import { useGameStore } from "@/store/gameStore";
import { useAccount } from "wagmi";
import { GameStatus } from "@/lib/contractCalls";
import BackgroundImgBlur from "@/component/BackgroundBlur";
import Link from "next/link";

export default function GameScreen() {
  const router = useRouter();
  const { gameId: gameIdStr } = useParams();
  const { address, isConnected } = useAccount();
  const { currentPlayerGame, currentCreatorGame } = useGameStore();

  useEffect(() => {
    if (!gameIdStr) {
      if (isConnected && address) {
        if (currentPlayerGame && currentPlayerGame.status !== GameStatus.Ended) {
          router.push(`/GameScreen/${currentPlayerGame.gameId.toString()}`);
        } else if (
          currentCreatorGame &&
          currentCreatorGame.status !== GameStatus.Ended
        ) {
          router.push(`/GameScreen/${currentCreatorGame.gameId.toString()}`);
        } else {
          router.push("/Home");
        }
      } else {
        router.push("/Home");
      }
    }
  }, [
    gameIdStr,
    currentPlayerGame,
    currentCreatorGame,
    isConnected,
    address,
    router,
  ]);

  let gameId: bigint;
  try {
    gameId = BigInt(gameIdStr as string);
    if (gameId <= 0) throw new Error("Game ID must be positive");
  } catch (err) {
    console.error("Invalid gameId:", gameIdStr, err);
    return (
      <BackgroundImgBlur>
        <div className="flex flex-col justify-center items-center min-h-screen text-red-400 px-4 mb-5">
          <p className="text-base sm:text-lg">Invalid game ID</p>
          <Link
            href="/Home"
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm sm:text-base"
          >
            Back to Home
          </Link>
        </div>
      </BackgroundImgBlur>
    );
  }

  return (
    <BackgroundImgBlur>
      <WheelOfFortune gameId={gameId} />
    </BackgroundImgBlur>
  );
}
