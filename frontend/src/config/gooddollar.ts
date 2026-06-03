import { celo } from "wagmi/chains";

/** G$ on Celo mainnet — https://docs.gooddollar.org/for-developers/developer-guides/how-to-integrate-the-gusd-token */
export const G_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_G_TOKEN_ADDRESS ||
  "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A") as `0x${string}`;

export const G_TOKEN_DECIMALS = 18;

export const G_TOKEN_SYMBOL = "G$";

/** Staging G$ on Celo (for testnets) */
export const G_TOKEN_STAGING =
  "0x61FA0fB802fd8345C06da558240E0651886fec69" as `0x${string}`;

export const GOODDOLLAR_ENV =
  (process.env.NEXT_PUBLIC_GOODDOLLAR_ENV as "production" | "staging") ||
  "production";

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const CELO_CHAIN_ID = celo.id;
