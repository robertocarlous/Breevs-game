const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxy = "0x641ff69fe26c504a8a06E611D2a961A39f2a796b";
  const code = await ethers.provider.getCode(proxy);
  console.log("proxy code length:", code.length);
  const Factory = await ethers.getContractFactory("BreevsRussianRoulette");
  const c = Factory.attach(proxy);
  try {
    console.log("MAX_PLAYERS:", (await c.MAX_PLAYERS()).toString());
    console.log("gToken:", await c.gToken());
    console.log("gameCounter:", (await c.gameCounter()).toString());
  } catch (e) {
    console.log("proxy read failed:", e.message);
  }
  try {
    const implAddr = await upgrades.erc1967.getImplementationAddress(proxy);
    console.log("ERC1967 impl:", implAddr);
  } catch (e) {
    console.log("getImplementationAddress failed:", e.message);
  }
}

main().catch(console.error);
