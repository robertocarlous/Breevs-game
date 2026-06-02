require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY || "";

if (!PRIVATE_KEY) {
  console.warn(
    "WARNING: PRIVATE_KEY not set in .env — deployment will fail.\n" +
    "Create a .env file with: PRIVATE_KEY=your_wallet_private_key_here"
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
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },

    // ── Celo Mainnet ──────────────────────────────────────────────────────
    // Chain ID : 42220
    "celo-mainnet": {
      url: "https://forno.celo.org",
      chainId: 42220,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
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
