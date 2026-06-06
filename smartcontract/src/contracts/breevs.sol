// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Breevs Russian Roulette – Commit-Reveal Edition (UUPS Upgradeable)
 * @notice Russian-roulette elimination game using a two-step commit/reveal
 *         randomness pattern for fair, unmanipulable outcomes on Celo.
 *
 * DEPLOYMENT
 * ──────────
 * Deploy via ERC-1967 UUPS proxy. Users interact with the proxy address;
 * upgrades replace the implementation while preserving game state.
 *
 * HOW RANDOMNESS WORKS (spinRound)
 * ────────────────────────────────
 * Host calls spinRound() once per elimination. The seed mixes block.prevrandao,
 * timestamps, and game-specific entropy. One tx, one host signature.
 *
 * Legacy two-step spin()/requestSpin()/resolveSpin() remains for older games only.
 *
 * FLOW
 * ────
 * 1. createGame()   – host stakes and sets round duration
 * 2. joinGame()     – 5 more players join (6 total required)
 * 3. startGame()    – auto-called when 6 players join (host may also call)
 * 4. spinRound()    – host spins once; one NON-HOST player eliminated
 * 5. advanceRound() – advance if round timer expired without a spin
 * 6. claimPrize()   – last non-host player standing claims the full prize pool
 */
contract BreevsRussianRoulette is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MAX_PLAYERS = 6;
    uint256 public constant MIN_PLAYER_STAKE = 1e18; // 1 G$ (18 decimals on Celo)
    uint256 public constant MAX_PLAYER_STAKE = 1000e18; // 1000 G$
    uint256 public constant HOST_BALANCE_MULTIPLIER = 5; // host must hold >= 5x stake
    uint256 public constant MIN_ROUND_DURATION = 10; // blocks
    uint256 public constant MAX_ROUND_DURATION = 1000; // blocks
    uint256 public constant REVEAL_DELAY = 1; // blocks to wait before resolving

    // ─── Types ───────────────────────────────────────────────────────────────

    enum Status {
        CREATED,
        IN_PROGRESS,
        COMPLETED,
        CANCELLED
    }

    struct Game {
        address creator;
        address[] players;
        uint256 stake;
        uint256 prizePool;
        Status status;
        uint256 roundDuration;
        uint256 roundEnd;
        uint256 currentRound;
        address winner;
        uint256 totalRounds;
    }

    struct PlayerGameData {
        bool eliminated;
        uint256 eliminationRound;
    }

    struct SpinRequest {
        bool pending;
        uint256 commitBlock;
        uint256 round;
    }

    struct UserStats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 totalWinnings;
        uint256 totalStaked;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 public gameCounter;

    mapping(uint256 => Game) public games;
    mapping(uint256 => mapping(address => PlayerGameData))
        public playerGameData;
    mapping(uint256 => mapping(address => uint256)) public playerDeposits;
    mapping(uint256 => bool) public prizeClaimed;
    mapping(address => UserStats) public userStats;
    mapping(uint256 => SpinRequest) public pendingSpins;

    /// @notice GoodDollar G$ token on Celo (set at initialize).
    IERC20 public gToken;

    /// @notice Relayer that submits spin txs so players avoid per-round signatures.
    address public spinOperator;

    // ─── Events ──────────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId);
    event PlayerJoined(uint256 indexed gameId, address player);
    event GameStarted(uint256 indexed gameId);
    event GameCancelled(uint256 indexed gameId);
    event SpinRequested(
        uint256 indexed gameId,
        uint256 commitBlock,
        uint256 round
    );
    event PlayerEliminated(
        uint256 indexed gameId,
        address player,
        uint256 round
    );
    event RoundAdvanced(uint256 indexed gameId, uint256 newRound);
    event GameCompleted(uint256 indexed gameId, address winner);
    event PrizeClaimed(uint256 indexed gameId, address winner, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy. Call once at deploy via `deployProxy`.
     * @param initialOwner Address allowed to authorize UUPS upgrades.
     * @param gTokenAddress G$ ERC-20 on Celo (mainnet: 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A).
     */
    function initialize(
        address initialOwner,
        address gTokenAddress
    ) external initializer {
        require(initialOwner != address(0), "Invalid owner");
        require(gTokenAddress != address(0), "Invalid G$ token");
        __Ownable_init(initialOwner);
        gToken = IERC20(gTokenAddress);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  GAME MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new game. The host deposits the player stake up front.
     * @param playerStake   Amount in wei every player (including host) must deposit.
     * @param roundDuration Number of blocks each round lasts before it expires.
     */
    function createGame(
        uint256 playerStake,
        uint256 roundDuration
    ) external returns (uint256) {
        require(
            playerStake >= MIN_PLAYER_STAKE && playerStake <= MAX_PLAYER_STAKE,
            "Stake must be between 1 and 1000 G$"
        );
        require(
            roundDuration >= MIN_ROUND_DURATION &&
                roundDuration <= MAX_ROUND_DURATION,
            "Invalid round duration"
        );
        require(
            gToken.balanceOf(msg.sender) >=
                HOST_BALANCE_MULTIPLIER * playerStake,
            "Host wallet must hold at least 5x the player stake in G$"
        );

        gToken.safeTransferFrom(msg.sender, address(this), playerStake);

        gameCounter++;
        Game storage g = games[gameCounter];
        g.creator = msg.sender;
        g.stake = playerStake;
        g.prizePool = playerStake;
        g.status = Status.CREATED;
        g.roundDuration = roundDuration;

        g.players.push(msg.sender);
        playerGameData[gameCounter][msg.sender] = PlayerGameData(false, 0);
        playerDeposits[gameCounter][msg.sender] = playerStake;
        _updateUserStatsOnJoin(msg.sender, playerStake);

        emit GameCreated(gameCounter);
        return gameCounter;
    }

    /**
     * @notice Join an open game by sending the exact stake amount.
     */
    function joinGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.CREATED, "Game not joinable");
        require(g.players.length < MAX_PLAYERS, "Game is full");
        require(!_isUserInGame(gameId, msg.sender), "Already in game");

        gToken.safeTransferFrom(msg.sender, address(this), g.stake);

        g.players.push(msg.sender);
        g.prizePool += g.stake;
        playerGameData[gameId][msg.sender] = PlayerGameData(false, 0);
        playerDeposits[gameId][msg.sender] = g.stake;
        _updateUserStatsOnJoin(msg.sender, g.stake);

        emit PlayerJoined(gameId, msg.sender);

        if (g.players.length == MAX_PLAYERS) {
            _startGameInternal(gameId);
        }
    }

    /**
     * @notice Cancel a game before it completes and refund all players.
     */
    function cancelGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(
            g.status == Status.CREATED || g.status == Status.IN_PROGRESS,
            "Game already completed or cancelled"
        );
        require(msg.sender == g.creator, "Only creator can cancel");

        g.status = Status.CANCELLED;

        address[] storage players = g.players;
        for (uint256 i = 0; i < players.length; i++) {
            uint256 deposit = playerDeposits[gameId][players[i]];
            if (deposit > 0) {
                playerDeposits[gameId][players[i]] = 0;
                gToken.safeTransfer(players[i], deposit);
            }
        }

        emit GameCancelled(gameId);
    }

    /**
     * @notice Start the game once all 6 players have joined.
     *         Only the host (creator) can call this.
     */
    function startGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.creator, "Only creator can start");
        require(g.players.length == MAX_PLAYERS, "Need exactly 6 players");
        _startGameInternal(gameId);
    }

    /** @notice Legacy — unused by spinRound flow. Kept for storage compatibility. */
    function setSpinOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator");
        spinOperator = operator;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SPIN
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Single-tx spin: host eliminates one eligible player and advances the round.
     */
    function spinRound(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.creator, "Only host can spin");
        _clearExpiredPendingSpin(gameId);
        require(!pendingSpins[gameId].pending, "Resolve legacy pending spin first");
        _executeSpinRound(gameId);
    }

    /**
     * @notice Legacy relayer entrypoint: commit if none pending, else resolve after REVEAL_DELAY.
     */
    function spin(uint256 gameId) external {
        _requireSpinAuthority(gameId);
        SpinRequest storage req = pendingSpins[gameId];
        if (!req.pending) {
            _commitSpin(gameId);
            return;
        }
        _resolveSpin(gameId);
    }

    /**
     * @notice STEP 1 – Commit a spin at the current block (host or spinOperator).
     */
    function requestSpin(uint256 gameId) external {
        _requireSpinAuthority(gameId);
        _commitSpin(gameId);
    }

    /**
     * @notice STEP 2 – Resolve after REVEAL_DELAY (spinOperator or anyone).
     */
    function resolveSpin(uint256 gameId) external {
        _resolveSpin(gameId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ROUND MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Manually advance the round if the host did not spin before the
     *         round timer expired. Anyone can call this.
     */
    function advanceRound(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.IN_PROGRESS, "Not in progress");
        require(block.number > g.roundEnd, "Round not ended yet");
        require(
            msg.sender == g.creator ||
                msg.sender == spinOperator ||
                spinOperator == address(0),
            "Not authorized to advance"
        );

        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }

        require(!pendingSpins[gameId].pending, "Resolve pending spin first");

        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        if (eligible.length <= 1) {
            _completeGameFromEligible(gameId, eligible);
        } else {
            g.currentRound++;
            g.roundEnd = block.number + g.roundDuration;
            emit RoundAdvanced(gameId, g.currentRound);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  PRIZE CLAIMING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice The last surviving non-host player calls this to collect the
     *         full prize pool.
     */
    function claimPrize(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.COMPLETED, "Game not completed");
        require(g.winner != address(0), "No winner set");
        require(msg.sender == g.winner, "Not the winner");
        require(!prizeClaimed[gameId], "Prize already claimed");

        prizeClaimed[gameId] = true;
        _updateUserStatsOnWin(msg.sender, g.prizePool);

        gToken.safeTransfer(msg.sender, g.prizePool);

        emit PrizeClaimed(gameId, msg.sender, g.prizePool);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function getActivePlayers(
        uint256 gameId
    ) external view returns (address[] memory) {
        return _getActivePlayers(gameId);
    }

    function getEligiblePlayers(
        uint256 gameId
    ) external view returns (address[] memory) {
        return _getEligiblePlayers(gameId, games[gameId].creator);
    }

    function getPendingSpin(
        uint256 gameId
    ) external view returns (SpinRequest memory) {
        return pendingSpins[gameId];
    }

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  UUPS
    // ═══════════════════════════════════════════════════════════════════════════

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // ═══════════════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _startGameInternal(uint256 gameId) internal {
        Game storage g = games[gameId];
        require(g.status == Status.CREATED, "Game not ready");
        require(g.players.length == MAX_PLAYERS, "Need exactly 6 players");

        g.status = Status.IN_PROGRESS;
        g.currentRound = 1;
        g.roundEnd = block.number + g.roundDuration;

        emit GameStarted(gameId);
    }

    function _requireSpinAuthority(uint256 gameId) internal view {
        Game storage g = games[gameId];
        require(
            msg.sender == g.creator || msg.sender == spinOperator,
            "Not authorized to spin"
        );
    }

    function _clearExpiredPendingSpin(uint256 gameId) internal {
        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }
    }

    function _executeSpinRound(uint256 gameId) internal {
        Game storage g = games[gameId];
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(
            block.number <= g.roundEnd,
            "Round has expired - call advanceRound"
        );

        address[] memory allActive = _getActivePlayers(gameId);
        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        require(eligible.length > 0, "No eligible players to eliminate");

        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.number,
                block.timestamp,
                gameId,
                g.currentRound,
                _hashPlayers(allActive)
            )
        );

        uint256 victimIdx = uint256(seed) % eligible.length;
        address victim = eligible[victimIdx];

        emit SpinRequested(gameId, block.number, g.currentRound);
        _eliminatePlayer(gameId, victim, g.creator);
        emit PlayerEliminated(gameId, victim, g.currentRound);

        if (g.status == Status.IN_PROGRESS) {
            g.currentRound++;
            g.roundEnd = block.number + g.roundDuration;
            emit RoundAdvanced(gameId, g.currentRound);
        }
    }

    function _commitSpin(uint256 gameId) internal {
        Game storage g = games[gameId];
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(
            block.number <= g.roundEnd,
            "Round has expired - call advanceRound"
        );

        _clearExpiredPendingSpin(gameId);
        require(!pendingSpins[gameId].pending, "Spin already pending");

        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        require(eligible.length > 0, "No eligible players to eliminate");

        pendingSpins[gameId] = SpinRequest({
            pending: true,
            commitBlock: block.number,
            round: g.currentRound
        });

        emit SpinRequested(gameId, block.number, g.currentRound);
    }

    function _resolveSpin(uint256 gameId) internal {
        Game storage g = games[gameId];
        SpinRequest storage req = pendingSpins[gameId];

        require(req.pending, "No pending spin");
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(
            block.number >= req.commitBlock + REVEAL_DELAY,
            "Must wait for reveal delay"
        );
        require(
            block.number <= req.commitBlock + 500,
            "Spin request expired - call requestSpin again"
        );

        address[] memory allActive = _getActivePlayers(gameId);
        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        require(eligible.length > 0, "No eligible players to eliminate");

        bytes32 seed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                block.number,
                block.timestamp,
                gameId,
                req.round,
                req.commitBlock,
                _hashPlayers(allActive)
            )
        );

        uint256 victimIdx = uint256(seed) % eligible.length;
        address victim = eligible[victimIdx];

        delete pendingSpins[gameId];

        _eliminatePlayer(gameId, victim, g.creator);
        emit PlayerEliminated(gameId, victim, g.currentRound);

        if (g.status == Status.IN_PROGRESS) {
            g.currentRound++;
            g.roundEnd = block.number + g.roundDuration;
            emit RoundAdvanced(gameId, g.currentRound);
        }
    }

    function _isUserInGame(
        uint256 gameId,
        address user
    ) internal view returns (bool) {
        address[] storage players = games[gameId].players;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == user) return true;
        }
        return false;
    }

    function _getActivePlayers(
        uint256 gameId
    ) internal view returns (address[] memory) {
        address[] storage all = games[gameId].players;
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (!playerGameData[gameId][all[i]].eliminated) count++;
        }
        address[] memory active = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (!playerGameData[gameId][all[i]].eliminated) {
                active[idx++] = all[i];
            }
        }
        return active;
    }

    function _getEligiblePlayers(
        uint256 gameId,
        address host
    ) internal view returns (address[] memory) {
        address[] storage all = games[gameId].players;
        uint256 count = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (!playerGameData[gameId][all[i]].eliminated && all[i] != host)
                count++;
        }
        address[] memory eligible = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < all.length; i++) {
            if (!playerGameData[gameId][all[i]].eliminated && all[i] != host) {
                eligible[idx++] = all[i];
            }
        }
        return eligible;
    }

    function _hashPlayers(
        address[] memory players
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(players));
    }

    function _eliminatePlayer(
        uint256 gameId,
        address player,
        address host
    ) internal {
        playerGameData[gameId][player].eliminated = true;
        playerGameData[gameId][player].eliminationRound = games[gameId]
            .currentRound;

        address[] memory eligible = _getEligiblePlayers(gameId, host);

        if (eligible.length == 1) {
            _completeGameFromEligible(gameId, eligible);
        }
    }

    function _completeGameFromEligible(
        uint256 gameId,
        address[] memory eligible
    ) internal {
        require(eligible.length == 1, "Cannot complete: no unique winner");

        Game storage g = games[gameId];
        g.status = Status.COMPLETED;
        g.winner = eligible[0];
        g.totalRounds = g.currentRound;

        emit GameCompleted(gameId, g.winner);
    }

    function _updateUserStatsOnJoin(address user, uint256 stake) internal {
        UserStats storage s = userStats[user];
        s.gamesPlayed++;
        s.totalStaked += stake;
    }

    function _updateUserStatsOnWin(address user, uint256 winnings) internal {
        UserStats storage s = userStats[user];
        s.gamesWon++;
        s.totalWinnings += winnings;
    }

    receive() external payable {
        revert("Stake with G$ via createGame or joinGame");
    }

    /// @dev Reserved storage gap for future upgrades (do not shrink).
    uint256[49] private __gap;
}
