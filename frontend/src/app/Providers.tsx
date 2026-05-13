"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { celoSepolia as _celoSepolia } from "wagmi/chains";
import { http, fallback } from "wagmi";
import { ReactNode } from "react";

const FORNO_RPC = "https://forno.celo-sepolia.celo-testnet.org";

const sepoliaRpcs = [
  FORNO_RPC,
  process.env.NEXT_PUBLIC_CELO_RPC_URL,
].filter(Boolean) as string[];

// Override rpcUrls so MetaMask receives our RPC when wallet_addEthereumChain is called
export const celoSepolia = {
  ..._celoSepolia,
  rpcUrls: {
    default: { http: sepoliaRpcs },
    public: { http: sepoliaRpcs },
  },
} as const;

const config = getDefaultConfig({
  appName: "Breevs",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "breevsrussianroulette",
  chains: [celoSepolia],
  transports: {
    [_celoSepolia.id]: fallback(sepoliaRpcs.map((url) => http(url))),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
