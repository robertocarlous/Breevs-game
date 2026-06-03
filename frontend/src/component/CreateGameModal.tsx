"use client";
import Modal from "@/component/ResuableModal";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useGBalance } from "@/hooks/useGoodDollar";
import { celo } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCreateGame } from "@/hooks/useGame";
import { useGameStore } from "@/store/gameStore";
import { getGameInfo, GameStatus, STAKE_OPTIONS } from "@/lib/contractCalls";
import { showErrorToast, showSuccessToast, showTransactionToast } from "@/component/Toast";
import { formatEther } from "viem";

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROUND_DURATION = 900n; // blocks (~30 min on Celo Sepolia L2 at ~2s/block)

const CreateGameModal: React.FC<CreateGameModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const { mutateAsync: createGame, isPending } = useCreateGame();
  const { setCurrentCreatorGame, getCurrentActiveGame, hasActiveGame, updateGameStatus } = useGameStore();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [selectedStakeIndex, setSelectedStakeIndex] = useState(0);

  const isWrongChain = isConnected && chainId !== celo.id;
  const selectedOption = STAKE_OPTIONS[selectedStakeIndex];
  const { data: gBalance } = useGBalance();
  // Contract requires creator wallet to hold ≥ 5× stake in G$ (HOST_BALANCE_MULTIPLIER = 5)
  const requiredBalance = selectedOption.value * 5n;
  const hasEnoughBalance = gBalance !== undefined ? gBalance >= requiredBalance : true;

  const handleSwitchChain = async () => {
    setSwitchError(null);
    try {
      await switchChainAsync({ chainId: celo.id });
    } catch {
      setSwitchError("Failed to switch network. Please switch manually in your wallet.");
    }
  };

  const handleCreateGame = async () => {
    if (!isConnected || !address) {
      if (openConnectModal) openConnectModal();
      return;
    }

    if (hasActiveGame(address)) {
      const activeGame = getCurrentActiveGame(address);
      if (activeGame) {
        // Verify live status from the contract — local store may be stale
        try {
          const freshGame = await getGameInfo(activeGame.gameId);
          const isOver =
            freshGame.status === GameStatus.Ended ||
            freshGame.status === GameStatus.Cancelled;
          if (isOver) {
            // Game actually ended — sync the store and let creation proceed
            updateGameStatus(freshGame.gameId, freshGame.status);
          } else {
            showErrorToast(
              `You have an active game (#${activeGame.gameId}). Please complete it first.`,
              "Active Game"
            );
            router.push(`/GameScreen/${activeGame.gameId.toString()}`);
            onClose();
            return;
          }
        } catch {
          // If the contract read fails, fall through and let the tx itself revert
        }
      }
    }

    try {
      const { txId, gameId } = await createGame({
        duration: ROUND_DURATION,
        stake: selectedOption.value,
      });

      showTransactionToast(
        txId,
        "success",
        `${celo.blockExplorers.default.url}/tx/${txId}`
      );

      const gameInfo = await getGameInfo(gameId);
      setCurrentCreatorGame(gameInfo);

      showSuccessToast("Game created successfully!", "Success");

      onClose();
      router.push(`/GameScreen/${gameId}`);
    } catch (err: any) {
      const errorMessage = err.message?.includes("rejected")
        ? "Transaction rejected by user"
        : err.message || "Failed to create game. Please try again.";
      showErrorToast(errorMessage, "Create Game Error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-[#030B1F] text-white p-5 sm:p-7 rounded-2xl border border-red-500/20 max-w-sm w-full mb-[80px] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎰</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
            Create Game Room
          </h2>
          <p className="text-xs text-gray-500">
            Choose your stake. Winner takes the prize pool.
          </p>
        </div>

        {/* Stake Selector */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3 text-center">
            Select Stake Amount
          </p>
          <div className="grid grid-cols-5 gap-2">
            {STAKE_OPTIONS.map((option, index) => {
              const isSelected = selectedStakeIndex === index;
              return (
                <button
                  key={option.label}
                  onClick={() => setSelectedStakeIndex(index)}
                  className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? "border-red-500 bg-red-600/20 shadow-lg shadow-red-500/30 scale-105"
                      : "border-white/10 bg-white/5 hover:border-red-500/40 hover:bg-white/10"
                  }`}
                >
                  <span
                    className={`text-sm sm:text-base font-bold ${
                      isSelected ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="text-[9px] text-gray-500 mt-0.5">G$</span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full shadow-md shadow-red-500/60" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prize Pool Preview */}
        <div className="mb-5 bg-[#0B1445]/80 border border-amber-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Prize Pool</p>
          <p className="text-3xl font-bold text-amber-400 drop-shadow-lg">
            {selectedOption.prize} G$
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            {selectedOption.label} G$ × 6 players
          </p>
        </div>

        {/* Wrong Network Warning */}
        {isWrongChain && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-xl">
            <p className="text-xs text-red-300 text-center mb-2">
              Wrong network. Switch to{" "}
              <span className="font-bold text-white">Celo Mainnet</span>.
            </p>
            {switchError && (
              <p className="text-xs text-red-400 text-center mb-2">{switchError}</p>
            )}
            <button
              className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
              onClick={handleSwitchChain}
              disabled={isSwitching}
            >
              {isSwitching ? "Switching..." : "Switch to Celo Mainnet"}
            </button>
          </div>
        )}

        {/* Wallet Warning */}
        {!isConnected && (
          <div className="mb-4 p-2 bg-amber-900/20 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-300 text-center">
              Connect your wallet to proceed
            </p>
          </div>
        )}

        {/* Host balance requirement warning */}
        {isConnected && !isWrongChain && !hasEnoughBalance && (
          <div className="mb-4 p-3 bg-amber-900/30 border border-amber-500/40 rounded-xl">
            <p className="text-xs text-amber-300 text-center">
              ⚠️ Your wallet needs at least{" "}
              <span className="font-bold text-white">{formatEther(requiredBalance)} G$</span>{" "}
              to host this game (5× the stake). You currently have{" "}
              <span className="font-bold text-white">
                {gBalance !== undefined ? Number(formatEther(gBalance)).toFixed(3) : "..."} G$
              </span>.
            </p>
          </div>
        )}

        {/* Create Button */}
        <button
          className={`w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg shadow-red-600/30 text-sm ${
            isPending || !isConnected || isWrongChain || !hasEnoughBalance
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-[1.02] hover:shadow-red-500/50"
          }`}
          onClick={handleCreateGame}
          disabled={isPending || isWrongChain || !hasEnoughBalance}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Creating Room...
            </span>
          ) : isConnected ? (
            `🎰 Create Game Room — ${selectedOption.label} G$`
          ) : (
            "Connect Wallet"
          )}
        </button>

        <p className="text-center text-[10px] text-gray-600 mt-3">
          Stake is locked until the game ends. Winner claims the full prize pool.
        </p>
      </div>
    </Modal>
  );
};

export default CreateGameModal;
