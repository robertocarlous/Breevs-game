const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=========================================");
  console.log("  Breevs Russian Roulette - UUPS Deploy ");
  console.log("=========================================");
  console.log("Network    :", network.name);
  console.log("Chain ID   :", network.chainId.toString());
  console.log("Deployer   :", deployer.address);
  console.log(
    "Balance    :",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "CELO"
  );
  console.log("-----------------------------------------");

  const Factory = await ethers.getContractFactory("BreevsRussianRoulette");

  console.log("Deploying UUPS proxy + implementation...");
  const proxy = await upgrades.deployProxy(
    Factory,
    [deployer.address],
    { kind: "uups", initializer: "initialize" }
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("-----------------------------------------");
  console.log("Proxy deployed (use this in the frontend):", proxyAddress);
  console.log("Implementation:", implementationAddress);
  console.log("Owner (can upgrade):", deployer.address);
  console.log("-----------------------------------------");

  const maxPlayers = await proxy.MAX_PLAYERS();
  const minStake = await proxy.MIN_PLAYER_STAKE();
  const maxStake = await proxy.MAX_PLAYER_STAKE();
  const hostMultiplier = await proxy.HOST_BALANCE_MULTIPLIER();
  const minRound = await proxy.MIN_ROUND_DURATION();
  const maxRound = await proxy.MAX_ROUND_DURATION();

  console.log("MAX_PLAYERS             :", maxPlayers.toString());
  console.log("MIN_PLAYER_STAKE        :", ethers.formatEther(minStake), "CELO");
  console.log("MAX_PLAYER_STAKE        :", ethers.formatEther(maxStake), "CELO");
  console.log("HOST_BALANCE_MULTIPLIER :", hostMultiplier.toString(), "x");
  console.log("MIN_ROUND_DURATION      :", minRound.toString(), "blocks");
  console.log("MAX_ROUND_DURATION      :", maxRound.toString(), "blocks");
  console.log("-----------------------------------------");

  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    proxyType: "UUPS",
    contractAddress: proxyAddress,
    proxyAddress,
    implementationAddress,
    owner: deployer.address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    constants: {
      MAX_PLAYERS: maxPlayers.toString(),
      MIN_PLAYER_STAKE_CELO: ethers.formatEther(minStake),
      MAX_PLAYER_STAKE_CELO: ethers.formatEther(maxStake),
      HOST_BALANCE_MULTIPLIER: hostMultiplier.toString(),
      MIN_ROUND_DURATION_BLOCKS: minRound.toString(),
      MAX_ROUND_DURATION_BLOCKS: maxRound.toString(),
    },
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("Saved deployment.json");
  console.log("=========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
