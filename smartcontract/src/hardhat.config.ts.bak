import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {networks: {
  celoSepolia: {
    url: "https://forno.celo-sepolia.celo-testnet.org/",
    accounts: [process.env.PRIVATE_KEY!],
    chainId: 11142220,
  },
},
etherscan: {
  apiKey: process.env.ETHERSCAN_API_KEY!, // v2 unified key
  customChains: [
    {
      network: "celoSepolia",
      chainId: 11142220,
      urls: {
        apiURL: "https://api.etherscan.io/v2/api",
        browserURL: "https://sepolia.celoscan.io",
      },
    },
  ],
},
};

export default config;
