"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Open_Sans } from "next/font/google";
import { Wallet } from "lucide-react";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "700"] });

interface WalletDisplayProps {
  showBalance?: boolean;
}

const WalletDisplay: React.FC<WalletDisplayProps> = ({ showBalance = true }) => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, openAccountModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) return null;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className={`${openSans.className} flex items-center gap-2 bg-[#191f57] hover:bg-[#1e2870] text-white px-8 py-2.5 rounded-full font-semibold transition-all duration-200 shadow-lg z-40`}
            >
              <Wallet size={18} />
              Connect Wallet
            </button>
          );
        }

        return (
          <div className="flex flex-col items-center space-y-3 z-40">
            {/* Chain warning */}
            {chain.unsupported && (
              <button
                onClick={openChainModal}
                className="bg-red-700 text-white text-xs px-4 py-1.5 rounded-full font-bold"
              >
                Wrong network — switch to Celo
              </button>
            )}

            {/* Address bar */}
            <button
              onClick={openAccountModal}
              className={`${openSans.className} flex items-center gap-2 bg-[#191f57] hover:bg-[#1e2870] text-white px-6 py-2 rounded-full transition-all duration-200`}
            >
              <Wallet size={16} />
              <span>{account.displayName}</span>
            </button>

            {showBalance && account.displayBalance && (
              <div className={`${openSans.className} bg-gray-300 rounded-full text-sm py-1 px-4 font-semibold text-[#1B225D]`}>
                Balance: <span className="text-red-500 ml-1">{account.displayBalance}</span>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletDisplay;
