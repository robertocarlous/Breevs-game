import hardhat from "hardhat";
import { expect } from "chai";
import type { Signer } from "ethers";

const { ethers, upgrades } = hardhat;

const ONE_G = ethers.parseEther("1");
const ROUND_BLOCKS = 20n;
const MINT_AMOUNT = ethers.parseEther("10000");

async function deployFresh() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;

  const Mock = await ethers.getContractFactory("MockERC20");
  const gMock = await Mock.deploy("GoodDollar", "G$");
  await gMock.waitForDeployment();
  const gAddr = await gMock.getAddress();

  for (const s of signers.slice(0, 10)) {
    await gMock.mint(await s.getAddress(), MINT_AMOUNT);
  }

  const Factory = await ethers.getContractFactory("BreevsRussianRoulette");
  const contract = await upgrades.deployProxy(
    Factory,
    [await deployer.getAddress(), gAddr],
    { kind: "uups", initializer: "initialize" }
  );
  await contract.waitForDeployment();
  const gameAddr = await contract.getAddress();

  return { contract, signers, gMock, gameAddr };
}

async function approveAndCreate(
  gMock: { connect: (s: Signer) => { approve: (a: string, v: bigint) => Promise<unknown> } },
  contract: { connect: (s: Signer) => { createGame: (a: bigint, b: bigint) => Promise<unknown> } },
  host: Signer,
  gameAddr: string,
  stake = ONE_G
) {
  await gMock.connect(host).approve(gameAddr, stake);
  return contract.connect(host).createGame(stake, ROUND_BLOCKS);
}

async function approveAndJoin(
  gMock: { connect: (s: Signer) => { approve: (a: string, v: bigint) => Promise<unknown> } },
  contract: { connect: (s: Signer) => { joinGame: (id: bigint) => Promise<unknown> } },
  player: Signer,
  gameAddr: string,
  gameId: bigint,
  stake = ONE_G
) {
  await gMock.connect(player).approve(gameAddr, stake);
  return contract.connect(player).joinGame(gameId);
}

describe("BreevsRussianRoulette", function () {
  describe("Deployment", function () {
    it("starts with gameCounter = 0", async function () {
      const { contract } = await deployFresh();
      expect(await contract.gameCounter()).to.equal(0n);
    });

    it("exposes correct constants", async function () {
      const { contract } = await deployFresh();
      expect(await contract.MAX_PLAYERS()).to.equal(6n);
      expect(await contract.MIN_PLAYER_STAKE()).to.equal(ONE_G);
      expect(await contract.HOST_BALANCE_MULTIPLIER()).to.equal(5n);
    });
  });

  describe("joinGame() auto-start", function () {
    it("starts the game when the 6th player joins", async function () {
      const { contract, signers, gMock, gameAddr } = await deployFresh();
      const [host, p2, p3, p4, p5, p6] = signers;

      await approveAndCreate(gMock, contract, host, gameAddr);
      const gameId = 1n;

      for (const p of [p2, p3, p4, p5]) {
        await approveAndJoin(gMock, contract, p, gameAddr, gameId);
      }

      await expect(approveAndJoin(gMock, contract, p6, gameAddr, gameId))
        .to.emit(contract, "GameStarted")
        .withArgs(gameId);

      const g = await contract.getGame(gameId);
      expect(g.status).to.equal(1n); // IN_PROGRESS
    });
  });

  describe("spin operator", function () {
    it("allows spinOperator to commit and resolve without host wallet", async function () {
      const { contract, signers, gMock, gameAddr } = await deployFresh();
      const [host, p2, p3, p4, p5, p6, relayer] = signers;

      await contract.setSpinOperator(await relayer.getAddress());

      await approveAndCreate(gMock, contract, host, gameAddr);
      const gameId = 1n;
      for (const p of [p2, p3, p4, p5, p6]) {
        await approveAndJoin(gMock, contract, p, gameAddr, gameId);
      }

      const c = contract.connect(relayer);
      await c.spin(gameId);
      await ethers.provider.send("evm_mine", []);
      await c.spin(gameId);

      const eligible = await contract.getEligiblePlayers(gameId);
      expect(eligible.length).to.be.lessThan(5);
    });
  });

  describe("createGame()", function () {
    it("creates a game and emits GameCreated", async function () {
      const { contract, signers, gMock, gameAddr } = await deployFresh();
      const [host] = signers;

      await expect(approveAndCreate(gMock, contract, host, gameAddr))
        .to.emit(contract, "GameCreated")
        .withArgs(1n);

      expect(await contract.gameCounter()).to.equal(1n);
    });

    it("increments gameCounter for each new game", async function () {
      const { contract, signers, gMock, gameAddr } = await deployFresh();
      const [host] = signers;

      await approveAndCreate(gMock, contract, host, gameAddr);
      await approveAndCreate(gMock, contract, host, gameAddr);

      expect(await contract.gameCounter()).to.equal(2n);
    });
  });
});
