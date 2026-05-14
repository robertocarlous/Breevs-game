"use client";

import Modal from "@/component/ResuableModal";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { celoSepolia } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useJoinGame } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import {
  showErrorToast,
  showSuccessToast,
  showTransactionToast,
} from "@/component/Toast";
import { GameStatus, MIN_STAKE } from "@/lib/contractCalls";
import { formatEther } from "viem";

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const StakeModal: React.FC<StakeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { mutateAsync: joinGameMutation, isPending } = useJoinGame();
  const {
    selectedGame,
    setSelectedGame,
    setCurrentPlayerGame,
    hasActiveGame,
    getCurrentActiveGame,
    addToMyGames,
  } = useGameStore();
  const [txId, setTxId] = useState<string | null>(null);

  const stake = selectedGame?.stake ?? MIN_STAKE;
  const gameId = selectedGame?.gameId;
  const prizePool = selectedGame?.prizePool ?? 0n;
  const stakeDisplay = formatEther(stake > 0n ? stake : MIN_STAKE);
  const prizeDisplay = formatEther(prizePool > 0n ? prizePool : stake > 0n ? stake : MIN_STAKE);

  const handleStake = async () => {
    try {
      setTxId(null);

      if (!isConnected || !address) {
        if (openConnectModal) openConnectModal();
        return;
      }

      if (!selectedGame || !gameId) {
        showErrorToast("No game selected", "Invalid Game");
        return;
      }

      if (selectedGame.status !== GameStatus.Active) {
        showErrorToast("Cannot join a game that is not active", "Invalid Game");
        return;
      }

      const hasActive = hasActiveGame(address);
      const activeGame = getCurrentActiveGame(address);
      if (hasActive && activeGame && activeGame.gameId !== gameId) {
        showErrorToast(
          `You are already in an active game (#${activeGame.gameId}). Please complete it first.`,
          "Active Game"
        );
        router.push(`/GameScreen/${activeGame.gameId.toString()}`);
        return;
      }

      const tx = await joinGameMutation({ gameId, stake: stake > 0n ? stake : MIN_STAKE });

      if (selectedGame && address) {
        addToMyGames({ ...selectedGame, players: [...selectedGame.players, address] });
        setCurrentPlayerGame(selectedGame, address);
      }

      setTxId(tx.txId as string);

      showTransactionToast(
        tx.txId as string,
        "success",
        `${celoSepolia.blockExplorers.default.url}/tx/${tx.txId}`
      );
      showSuccessToast("Successfully joined the game!", "Success");

      onClose();
      setSelectedGame(null);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/GameScreen/${gameId}`);
      }
    } catch (err: any) {
      const errorMessage = err.message?.includes("rejected")
        ? "Transaction rejected by user"
        : err.message || "Failed to stake";
      showErrorToast(errorMessage, "Stake Error");
      setTxId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) setTxId(null);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-[#030B1F] text-white p-5 sm:p-7 rounded-2xl border border-red-500/20 max-w-sm w-full mb-[80px] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎯</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
            Join Game
          </h2>
          <p className="text-xs text-gray-500">Stake CELO to enter and compete</p>
        </div>

        {/* Stake amount */}
        <div className="bg-gradient-to-r from-red-500/10 to-red-800/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
          <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-widest">Required Stake</p>
          <p className="text-4xl font-bold text-red-500 drop-shadow-lg">
            {stakeDisplay}
          </p>
          <p className="text-xs text-gray-500 mt-1">CELO</p>
        </div>

        {/* Game info */}
        {selectedGame && (
          <div className="bg-[#0B1445]/80 border border-white/10 rounded-xl p-3 mb-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Game ID</span>
              <span className="text-xs font-bold text-white">#{selectedGame.gameId.toString()}</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Players</span>
              <span className="text-xs font-bold text-white">{selectedGame.playerCount}/6</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Prize Pool</span>
              <span className="text-xs font-bold text-amber-400">{prizeDisplay} CELO</span>
            </div>
          </div>
        )}

        {txId && (
          <div className="mb-4 p-2 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-xs text-green-300 text-center font-mono break-all">
              TX: {(txId as string).slice(0, 10)}...
            </p>
          </div>
        )}

        {!isConnected && (
          <div className="mb-4 p-2 bg-amber-900/20 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-300 text-center">
              Connect your wallet to proceed
            </p>
          </div>
        )}

        {/* Action button */}
        <button
          className={`w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-red-600/30 text-sm ${
            isPending || !isConnected ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] hover:shadow-red-500/50"
          }`}
          onClick={handleStake}
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : isConnected ? (
            `Stake ${stakeDisplay} CELO & Join`
          ) : (
            "Connect Wallet"
          )}
        </button>

        <p className="text-center text-[10px] text-gray-600 mt-3">
          Your stake is locked until the game ends.
        </p>
      </div>
    </Modal>
  );
};

export default StakeModal;
