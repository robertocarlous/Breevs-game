"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { celo as _celo } from "wagmi/chains";
import { http, fallback } from "wagmi";
import { ReactNode } from "react";

const FORNO_RPC = "https://forno.celo.org";

const celoRpcs = [
  FORNO_RPC,
  process.env.NEXT_PUBLIC_CELO_RPC_URL,
].filter(Boolean) as string[];

// Override rpcUrls so MetaMask receives our RPC when wallet_addEthereumChain is called
export const celo = {
  ..._celo,
  rpcUrls: {
    default: { http: celoRpcs },
    public: { http: celoRpcs },
  },
} as const;

const config = getDefaultConfig({
  appName: "Breevs",
  // This project ID must be registered at cloud.walletconnect.com with the
  // deployed domain whitelisted. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in
  // your deployment environment (Vercel / Render / etc.) before building.
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "a57f6a630362fdc53139d4d5fd7dcd59",
  chains: [celo],
  transports: {
    [_celo.id]: fallback(celoRpcs.map((url) => http(url))),
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
