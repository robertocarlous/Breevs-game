const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
  let proxy = process.env.PROXY_ADDRESS;
  if (!proxy && fs.existsSync("deployment.json")) {
    const saved = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
    proxy = saved.proxyAddress || saved.contractAddress;
  }
  const c = await ethers.getContractAt("BreevsRussianRoulette", proxy);
  const op = await c.spinOperator();
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log("proxy:", proxy);
  console.log("implementation:", impl);
  console.log("spinOperator:", op);
  console.log("MAX_PLAYERS:", (await c.MAX_PLAYERS()).toString());
}

main().catch(console.error);
