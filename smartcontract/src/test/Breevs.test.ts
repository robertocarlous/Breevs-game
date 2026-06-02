import hardhat from "hardhat";
import { expect } from "chai";
import type { ContractTransactionReceipt, Signer } from "ethers";

const { ethers, upgrades } = hardhat;

// ─── Constants mirroring the contract ────────────────────────────────────────
const ONE_CELO = ethers.parseEther("1");
const FIVE_CELO = ethers.parseEther("5");
const ROUND_BLOCKS = 20n;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Mine n empty blocks to advance block.number without sending value. */
async function mineBlocks(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

/** Deploy a fresh UUPS proxy before each test. */
async function deployFresh() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;

  const Factory = await ethers.getContractFactory("BreevsRussianRoulette");

  const contract = await upgrades.deployProxy(
    Factory,
    [await deployer.getAddress()],
    { kind: "uups", initializer: "initialize" }
  );
  await contract.waitForDeployment();

  return { contract, signers };
}

/**
 * Create + fill a game with 6 players
 * (host = signers[0], players = signers[1-5]).
 */
async function setupFullGame(contract: any, signers: Signer[]) {
  const [host, p1, p2, p3, p4, p5] = signers;

  const tx = await contract
    .connect(host)
    .createGame(ONE_CELO, ROUND_BLOCKS, {
      value: ONE_CELO,
    });

  const receipt = await tx.wait();

  const event = receipt.logs
    .map((l: any) => {
      try {
        return contract.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === "GameCreated");

  const gameId = event.args.gameId;

  for (const player of [p1, p2, p3, p4, p5]) {
    await contract.connect(player).joinGame(gameId, {
      value: ONE_CELO,
    });
  }

  return {
    gameId,
    host,
    players: [host, p1, p2, p3, p4, p5],
  };
}

/**
 * Start a full game and return gameId + all parties.
 */
async function setupStartedGame(contract: any, signers: Signer[]) {
  const setup = await setupFullGame(contract, signers);

  await contract.connect(setup.host).startGame(setup.gameId);

  return setup;
}

/**
 * Run spin() until only one player remains.
 */
async function runGameToCompletion(
  contract: any,
  gameId: bigint,
  host: Signer
) {
  let winner: string | null = null;

  for (let round = 0; round < 5; round++) {
    const active = await contract.getActivePlayers(gameId);

    if (active.length <= 1) break;

    const tx = await contract.connect(host).spin(gameId);

    const receipt = await tx.wait();

    const completed = receipt.logs
      .map((l: any) => {
        try {
          return contract.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "GameCompleted");

    if (completed) {
      winner = completed.args.winner;
      break;
    }
  }

  return winner;
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═════════════════════════════════════════════════════════════════════════════

describe("BreevsRussianRoulette", function () {

  // ── 1. DEPLOYMENT ──────────────────────────────────────────────────────────
  describe("Deployment", function () {

    it("starts with gameCounter = 0", async function () {
      const { contract } = await deployFresh();

      expect(await contract.gameCounter()).to.equal(0n);
    });

    it("exposes correct constants", async function () {
      const { contract } = await deployFresh();

      expect(await contract.MAX_PLAYERS()).to.equal(6n);
      expect(await contract.MIN_PLAYER_STAKE()).to.equal(
        ethers.parseEther("0.2")
      );
      expect(await contract.MIN_ROUND_DURATION()).to.equal(10n);
      expect(await contract.MAX_ROUND_DURATION()).to.equal(1000n);
      expect(await contract.HOST_BALANCE_MULTIPLIER()).to.equal(5n);
    });

  });

  // ── 2. CREATE GAME ─────────────────────────────────────────────────────────
  describe("createGame()", function () {

    it("creates a game and emits GameCreated", async function () {
      const { contract, signers } = await deployFresh();

      const [host] = signers;

      await expect(
        contract.connect(host).createGame(
          ONE_CELO,
          ROUND_BLOCKS,
          {
            value: ONE_CELO,
          }
        )
      )
        .to.emit(contract, "GameCreated")
        .withArgs(1n);

      expect(await contract.gameCounter()).to.equal(1n);
    });

    it("increments gameCounter for each new game", async function () {
      const { contract, signers } = await deployFresh();

      const [host] = signers;

      await contract.connect(host).createGame(
        ONE_CELO,
        ROUND_BLOCKS,
        {
          value: ONE_CELO,
        }
      );

      await contract.connect(host).createGame(
        ONE_CELO,
        ROUND_BLOCKS,
        {
          value: ONE_CELO,
        }
      );

      expect(await contract.gameCounter()).to.equal(2n);
    });

  });

});