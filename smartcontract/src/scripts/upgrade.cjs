const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

/**
 * Upgrade an existing UUPS proxy to a new implementation.
 *
 * Usage:
 *   PROXY_ADDRESS=0x... npx hardhat run scripts/upgrade.cjs --network celo-sepolia
 *
 * Or set proxyAddress in deployment.json (proxyAddress field).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  let proxyAddress =
    process.env.PROXY_ADDRESS ||
    process.env.CONTRACT_ADDRESS ||
    null;

  if (!proxyAddress && fs.existsSync("deployment.json")) {
    const saved = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
    proxyAddress = saved.proxyAddress || saved.contractAddress;
  }

  if (!proxyAddress) {
    throw new Error(
      "Set PROXY_ADDRESS or deploy first (deployment.json missing proxyAddress)"
    );
  }

  console.log("=========================================");
  console.log("  Breevs Russian Roulette - UUPS Upgrade ");
  console.log("=========================================");
  console.log("Network  :", network.name);
  console.log("Upgrader :", deployer.address);
  console.log("Proxy    :", proxyAddress);
  console.log("-----------------------------------------");

  const oldImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Current implementation:", oldImpl);

  const Factory = await ethers.getContractFactory("BreevsRussianRoulette");

  console.log("Upgrading proxy...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Factory, {
    kind: "uups",
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("-----------------------------------------");
  console.log("Upgrade complete!");
  console.log("New implementation:", newImpl);
  console.log("Proxy (unchanged) :", proxyAddress);
  console.log("-----------------------------------------");

  if (fs.existsSync("deployment.json")) {
    const saved = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
    saved.implementationAddress = newImpl;
    saved.upgradedAt = new Date().toISOString();
    saved.upgradedBy = deployer.address;
    fs.writeFileSync("deployment.json", JSON.stringify(saved, null, 2));
    console.log("Updated deployment.json");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Upgrade failed:", error);
    process.exit(1);
  });
