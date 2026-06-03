const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Set spinOperator on the proxy (owner-only). Use the relayer wallet address.
 *
 *   SPIN_OPERATOR=0x... npx hardhat run scripts/set-spin-operator.cjs --network celo-mainnet
 */
async function main() {
  const operator = process.env.SPIN_OPERATOR;
  if (!operator) throw new Error("Set SPIN_OPERATOR to the relayer wallet address");

  let proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress && fs.existsSync("deployment.json")) {
    const saved = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
    proxyAddress = saved.proxyAddress || saved.contractAddress;
  }
  if (!proxyAddress) throw new Error("Missing PROXY_ADDRESS / deployment.json");

  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt(
    "BreevsRussianRoulette",
    proxyAddress,
    signer
  );

  console.log("Proxy       :", proxyAddress);
  console.log("Owner signer:", signer.address);
  console.log("spinOperator:", operator);

  const tx = await contract.setSpinOperator(operator);
  await tx.wait();
  console.log("Done. tx:", tx.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
