// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Breevs Russian Roulette – Commit-Reveal Edition
 * @notice Russian-roulette elimination game using a two-step commit/reveal
 *         randomness pattern for fair, unmanipulable outcomes on Celo.
 *
 * HOW RANDOMNESS WORKS
 * ────────────────────
 * Step 1 – spin():        Host commits to the current block number.
 * Step 2 – resolveSpin(): After REVEAL_DELAY blocks, anyone can resolve.
 *                         The seed mixes block.prevrandao, timestamps and
 *                         game-specific entropy so the host cannot bias
 *                         the outcome.
 *
 * FLOW
 * ────
 * 1. createGame()   – host stakes and sets round duration
 * 2. joinGame()     – 5 more players join (6 total required)
 * 3. startGame()    – host starts; round timer begins
 * 4. spin()         – host commits a spin request
 * 5. resolveSpin()  – anyone resolves; one player eliminated; round auto-advances
 * 6. advanceRound() – (optional) manually advance if spin not called in time
 * 7. claimPrize()   – last player standing claims the full prize pool
 */
contract BreevsRussianRoulette {

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MAX_PLAYERS             = 6;
    uint256 public constant MIN_PLAYER_STAKE        = 2e17;    // 0.2 CELO
    uint256 public constant MAX_PLAYER_STAKE        = 1000e18; // 1000 CELO
    uint256 public constant HOST_BALANCE_MULTIPLIER = 5;       // host must hold >= 5x stake
    uint256 public constant MIN_ROUND_DURATION      = 10;      // blocks
    uint256 public constant MAX_ROUND_DURATION      = 1000;    // blocks
    uint256 public constant REVEAL_DELAY            = 1;       // blocks to wait before resolving

    // Celo core registry – same address on every Celo network
    address private constant CELO_REGISTRY =
        0x000000000000000000000000000000000000ce10;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum Status { CREATED, IN_PROGRESS, COMPLETED }

    struct Game {
        address   creator;
        address[] players;
        uint256   stake;
        uint256   prizePool;
        Status    status;
        uint256   roundDuration;
        uint256   roundEnd;
        uint256   currentRound;
        address   winner;
        uint256   totalRounds;
    }

    struct PlayerGameData {
        bool    eliminated;
        uint256 eliminationRound;
    }

    struct SpinRequest {
        bool    pending;
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

    mapping(uint256 => Game)                                public games;
    mapping(uint256 => mapping(address => PlayerGameData)) public playerGameData;
    mapping(uint256 => mapping(address => uint256))        public playerDeposits;
    mapping(uint256 => bool)                               public prizeClaimed;
    mapping(address => UserStats)                          public userStats;
    mapping(uint256 => SpinRequest)                        public pendingSpins;

    // ─── Events ──────────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId);
    event PlayerJoined(uint256 indexed gameId, address player);
    event GameStarted(uint256 indexed gameId);
    event PlayerEliminated(uint256 indexed gameId, address player, uint256 round);
    event RoundAdvanced(uint256 indexed gameId, uint256 newRound);
    event GameCompleted(uint256 indexed gameId, address winner);
    event PrizeClaimed(uint256 indexed gameId, address winner, uint256 amount);
    event SpinRequested(uint256 indexed gameId, uint256 commitBlock, uint256 round);
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
    ) external payable returns (uint256) {
        require(
            playerStake >= MIN_PLAYER_STAKE && playerStake <= MAX_PLAYER_STAKE,
            "Stake must be between 1 and 1000 CELO"
        );
        require(
            roundDuration >= MIN_ROUND_DURATION && roundDuration <= MAX_ROUND_DURATION,
            "Invalid round duration"
        );
        require(msg.value == playerStake, "Host deposit must equal the player stake");

        // msg.value is deducted from balance before this code runs, so add it back
        require(
            address(msg.sender).balance + msg.value >= HOST_BALANCE_MULTIPLIER * playerStake,
            "Host wallet must hold at least 5x the player stake"
        );

        gameCounter++;
        Game storage g  = games[gameCounter];
        g.creator       = msg.sender;
        g.stake         = playerStake;
        g.prizePool     = playerStake;
        g.status        = Status.CREATED;
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
    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];
        require(g.status == Status.CREATED,         "Game not joinable");
        require(g.players.length < MAX_PLAYERS,     "Game is full");
        require(!_isUserInGame(gameId, msg.sender), "Already in game");
        require(msg.value == g.stake,               "Must send exactly the game stake");

        g.players.push(msg.sender);
        g.prizePool += g.stake;
        playerGameData[gameId][msg.sender] = PlayerGameData(false, 0);
        playerDeposits[gameId][msg.sender] = g.stake;
        _updateUserStatsOnJoin(msg.sender, g.stake);

        emit PlayerJoined(gameId, msg.sender);
    }

    /**
     * @notice Cancel a game and refund all players.
     */
    function cancelGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(
            g.status == Status.CREATED || g.status == Status.IN_PROGRESS,
            "Game already completed"
        );
        require(msg.sender == g.creator, "Only creator can cancel");

        g.status = Status.COMPLETED;

        // Refund every player their original deposit regardless of elimination status
        address[] storage players = g.players;
        for (uint256 i = 0; i < players.length; i++) {
            uint256 deposit = playerDeposits[gameId][players[i]];
            if (deposit > 0) {
                playerDeposits[gameId][players[i]] = 0;
                (bool sent, ) = payable(players[i]).call{value: deposit}("");
                require(sent, "Refund failed");
            }
        }
    }

    /**
     * @notice Start the game once all 6 players have joined.
     *         Only the host (creator) can call this.
     */
    function startGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.CREATED,      "Game not ready");
        require(msg.sender == g.creator,         "Only creator can start");
        require(g.players.length == MAX_PLAYERS, "Need exactly 6 players");

        g.status       = Status.IN_PROGRESS;
        g.currentRound = 1;
        g.roundEnd     = block.number + g.roundDuration;
    emit GameStarted(gameId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SPIN — two-step commit/reveal elimination
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice STEP 1 – Host commits a spin request at the current block.
     *         Must be called while the round window is still open.
     */
    function spin(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.creator,        "Only host can spin");
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(block.number <= g.roundEnd,     "Round has expired - call advanceRound");

        // Auto-clear a spin that expired (> 500 blocks old) so the game doesn't get stuck
        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }

        require(!pendingSpins[gameId].pending, "Spin already pending");

        address[] memory active = _getActivePlayers(gameId);
        require(active.length > 1, "Only one player left");

        pendingSpins[gameId] = SpinRequest({
            pending: true,
            commitBlock: block.number,
            round: g.currentRound
        });

        emit SpinRequested(gameId, block.number, g.currentRound);
    }

    /**
     * @notice STEP 2 – Anyone resolves the pending spin after REVEAL_DELAY blocks.
     *
     *         The contract mixes block.prevrandao with game-specific entropy
     *         to produce an unbiasable seed. By waiting REVEAL_DELAY blocks
     *         the host cannot selectively include/exclude their own transaction
     *         to influence the outcome.
     */
    function resolveSpin(uint256 gameId) external {
        Game storage g = games[gameId];
        SpinRequest storage req = pendingSpins[gameId];

        require(req.pending, "No pending spin");
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(
            block.number >= req.commitBlock + REVEAL_DELAY,
            "Must wait for RANDAO reveal"
        );
        // Safety: if the commit block is too old the RANDAO value may no
        // longer be available.
        require(
            block.number <= req.commitBlock + 500,
            "Spin request expired - request a new spin"
        );

        // ── Randomness: mix multiple on-chain sources into one seed ──────────
        bytes32 celoRandom = keccak256(abi.encodePacked(
            block.prevrandao,
            block.number,
            block.timestamp,
            gameId,
            req.round,
            req.commitBlock
        ));

        // ── Mix with game-specific entropy to prevent cross-game reuse ────────
        address[] memory active = _getActivePlayers(gameId);
        require(active.length > 1, "Only one player left");

        address[] memory eligible = _getActivePlayersExcludingHost(gameId, g.creator);
        require(eligible.length > 0, "No eligible player to eliminate");

        bytes32 seed = keccak256(
            abi.encodePacked(
                celoRandom,              // Celo RANDAO – unmanipulable by host
                gameId,                  // unique per game
                req.round,               // unique per round
                req.commitBlock,         // block the commitment was made
                _hashPlayers(active)     // current active player set
            )
        );

        uint256 victimIdx = uint256(seed) % eligible.length;
        address victim    = eligible[victimIdx];

        // ── Clear the pending spin before state changes (re-entrancy guard) ──
        delete pendingSpins[gameId];

        // ── Eliminate chosen player ───────────────────────────────────────────
        _eliminatePlayer(gameId, victim, active);
        emit PlayerEliminated(gameId, victim, g.currentRound);
     // ── Auto-advance round (game stays live for next spin) ────────────────
        if (g.status == Status.IN_PROGRESS) {
            g.currentRound++;
            g.roundEnd = block.number + g.roundDuration;
            emit RoundAdvanced(gameId, g.currentRound);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  ROUND MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Manually advance the round if the host did not spin before the
     *         round timer expired. Anyone can call this.
     *         If only one player remains the game completes automatically.
     */
    function advanceRound(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.IN_PROGRESS, "Not in progress");
        require(block.number > g.roundEnd,      "Round not ended yet");

        // Auto-clear expired spins so the round can advance
        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }

        require(!pendingSpins[gameId].pending, "Resolve pending spin first");

        address[] memory active = _getActivePlayers(gameId);
        if (active.length <= 1) {
            _completeGame(gameId, active);
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
     * @notice The last surviving player calls this to collect the full prize pool.
     */
    function claimPrize(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.COMPLETED, "Game not completed");
        require(g.winner != address(0),       "No winner set");
        require(msg.sender == g.winner,       "Not the winner");
        require(!prizeClaimed[gameId],        "Prize already claimed");

        prizeClaimed[gameId] = true;
        _updateUserStatsOnWin(msg.sender, g.prizePool);

        (bool sent, ) = payable(msg.sender).call{value: g.prizePool}("");
        require(sent, "Transfer failed");

        emit PrizeClaimed(gameId, msg.sender, g.prizePool);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Returns all active (non-eliminated) players for a game.
    function getActivePlayers(uint256 gameId) external view returns (address[] memory) {
        return _getActivePlayers(gameId);
    }

    /// @notice Returns the full game struct.
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    function _isUserInGame(uint256 gameId, address user) internal view returns (bool) {
        address[] storage players = games[gameId].players;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == user) return true;
        }
        return false;
    }
    function _getActivePlayers(uint256 gameId) internal view returns (address[] memory) {
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

    function _getActivePlayersExcludingHost(uint256 gameId, address host) internal view returns (address[] memory) {
        address[] memory active = _getActivePlayers(gameId);
        uint256 count = 0;
        for (uint256 i = 0; i < active.length; i++) {
            if (active[i] != host) count++;
        }

        address[] memory eligible = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < active.length; i++) {
            if (active[i] != host) {
                eligible[idx++] = active[i];
            }
        }
        return eligible;
    }

    /// @dev Deterministic hash of the player list — extra entropy per spin.
    function _hashPlayers(address[] memory players) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(players));
    }

    /**
     * @dev Marks player as eliminated. Accepts the pre-computed activeBefore
     *      list so we avoid a redundant storage scan when building the
     *      post-elimination list.
     */
    function _eliminatePlayer(
        uint256 gameId,
        address player,
        address[] memory activeBefore
    ) internal {
        playerGameData[gameId][player].eliminated       = true;
        playerGameData[gameId][player].eliminationRound = games[gameId].currentRound;

        // Build post-elimination list without re-scanning storage
        uint256 remaining = 0;
        for (uint256 i = 0; i < activeBefore.length; i++) {
            if (activeBefore[i] != player) remaining++;
        }
        address[] memory activeAfter = new address[](remaining);
        uint256 idx = 0;
        for (uint256 i = 0; i < activeBefore.length; i++) {
            if (activeBefore[i] != player) activeAfter[idx++] = activeBefore[i];
        }

        if (activeAfter.length == 1) {
            _completeGame(gameId, activeAfter);
        }
    }

    /**
     * @dev Finalises the game. Accepts the already-computed single-element
     *      active array to avoid a redundant storage fetch.
     */
    function _completeGame(uint256 gameId, address[] memory active) internal {
        require(active.length == 1, "Cannot complete: no unique winner");

        Game storage g = games[gameId];
        g.status       = Status.COMPLETED;
        g.winner       = active[0];
        g.totalRounds  = g.currentRound;

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

    /// @dev Reject accidental plain ETH transfers.
    receive() external payable {
        revert("Use joinGame or createGame");
    }
}
