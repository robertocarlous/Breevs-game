require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** Normalize PRIVATE_KEY from .env (64 hex chars, optional 0x, strip stray '='). */
function parsePrivateKey(raw) {
  if (!raw) return [];
  let k = raw.trim().replace(/^['"]|['"]$/g, "");
  if (k.startsWith("=")) k = k.slice(1).trim();
  if (k.startsWith("0x")) k = k.slice(2);
  if (k.length === 64 && /^[0-9a-fA-F]+$/.test(k)) {
    return ["0x" + k];
  }
  return [];
}

const DEPLOYER_ACCOUNTS = parsePrivateKey(process.env.PRIVATE_KEY || "");
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY || "";

if (DEPLOYER_ACCOUNTS.length === 0) {
  console.warn(
    "WARNING: PRIVATE_KEY not set or invalid in .env — deployment will fail.\n" +
      "Use 64 hex characters (with or without 0x prefix)."
  );
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },

    // ── Celo Sepolia Testnet ──────────────────────────────────────────────
    // Chain ID : 11142220
    // Explorer : https://celo-sepolia.blockscout.com
    // Faucet   : https://faucet.celo.org/sepolia
    "celo-sepolia": {
      url: process.env.RPC_URL || "https://celo-sepolia.drpc.org",
      chainId: 11142220,
      accounts: DEPLOYER_ACCOUNTS,
    },

    // ── Celo Mainnet ──────────────────────────────────────────────────────
    // Chain ID : 42220
    "celo-mainnet": {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: DEPLOYER_ACCOUNTS,
    },
  },

  etherscan: {
    apiKey: {
      "celo-sepolia": CELOSCAN_API_KEY,
      "celo-mainnet": CELOSCAN_API_KEY,
    },
    customChains: [
      {
        network: "celo-sepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://celo-sepolia.blockscout.com/api",
          browserURL: "https://celo-sepolia.blockscout.com",
        },
      },
      {
        network: "celo-mainnet",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
};
