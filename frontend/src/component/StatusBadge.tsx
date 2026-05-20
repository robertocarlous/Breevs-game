"use client";

import { GameStatus } from "@/lib/contractCalls";

interface StatusBadgeProps {
  status: GameStatus;
  playerCount: number;
}

export default function StatusBadge({ status, playerCount }: StatusBadgeProps) {
  let color: string;
  let text: string;

  switch (status) {
    case GameStatus.Active:
      color = playerCount === 5 ? "bg-green-600" : "bg-blue-600";
      text = playerCount === 5 ? "Ready to Start" : "Waiting for Players";
      break;
    case GameStatus.InProgress:
      color = "bg-yellow-600";
      text = "In Progress";
      break;
    case GameStatus.Ended:
      color = "bg-gray-600";
      text = "Ended";
      break;
    case GameStatus.Cancelled:
      color = "bg-red-900";
      text = "Cancelled";
      break;
    default:
      color = "bg-gray-600";
      text = "Unknown";
  }

  return (
    <span
      className={`${color} text-white text-xs px-2 py-1 rounded-full font-medium`}
    >
      {text}
    </span>
  );
}
