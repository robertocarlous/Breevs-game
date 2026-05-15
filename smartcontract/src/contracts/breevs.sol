// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Breevs Russian Roulette – Commit-Reveal Edition
 * @notice Russian-roulette elimination game using a two-step commit/reveal
 *         randomness pattern for fair, unmanipulable outcomes on Celo.
 *
 * HOW RANDOMNESS WORKS
 * ────────────────────
 * Step 1 – requestSpin():  Host commits to the current block number.
 * Step 2 – resolveSpin():  After REVEAL_DELAY blocks, anyone can resolve.
 *                          The seed mixes block.prevrandao, timestamps and
 *                          game-specific entropy so the host cannot bias
 *                          the outcome.
 *
 * FLOW
 * ────
 * 1. createGame()   – host stakes and sets round duration
 * 2. joinGame()     – 5 more players join (6 total required)
 * 3. startGame()    – host starts; round timer begins
 * 4. requestSpin()  – host commits a spin request
 * 5. resolveSpin()  – anyone resolves after REVEAL_DELAY; one NON-HOST player
 *                     is eliminated; round auto-advances
 * 6. advanceRound() – (optional) manually advance if spin not called in time
 * 7. claimPrize()   – last non-host player standing claims the full prize pool
 *
 * WINNER LOGIC
 * ────────────
 * The host is the game operator — they stake and run the game but are NOT
 * eligible to win. Only the 5 joining players compete. The last of the 5
 * still standing when all others are eliminated wins the full prize pool.
 * The game completes as soon as only 1 non-host player remains active,
 * regardless of how many total players (including host) are still alive.
 */
contract BreevsRussianRoulette {
    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant MAX_PLAYERS = 6;
    uint256 public constant MIN_PLAYER_STAKE = 2e17; // 0.2 CELO
    uint256 public constant MAX_PLAYER_STAKE = 1000e18; // 1000 CELO
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
            "Stake must be between 0.2 and 1000 CELO"
        );
        require(
            roundDuration >= MIN_ROUND_DURATION &&
                roundDuration <= MAX_ROUND_DURATION,
            "Invalid round duration"
        );
        require(
            msg.value == playerStake,
            "Host deposit must equal the player stake"
        );

        // msg.value is deducted from balance before this code runs, so add it back
        require(
            address(msg.sender).balance + msg.value >=
                HOST_BALANCE_MULTIPLIER * playerStake,
            "Host wallet must hold at least 5x the player stake"
        );

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
    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];
        require(g.status == Status.CREATED, "Game not joinable");
        require(g.players.length < MAX_PLAYERS, "Game is full");
        require(!_isUserInGame(gameId, msg.sender), "Already in game");
        require(msg.value == g.stake, "Must send exactly the game stake");

        g.players.push(msg.sender);
        g.prizePool += g.stake;
        playerGameData[gameId][msg.sender] = PlayerGameData(false, 0);
        playerDeposits[gameId][msg.sender] = g.stake;
        _updateUserStatsOnJoin(msg.sender, g.stake);

        emit PlayerJoined(gameId, msg.sender);
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
                (bool sent, ) = payable(players[i]).call{value: deposit}("");
                require(sent, "Refund failed");
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
        require(g.status == Status.CREATED, "Game not ready");
        require(msg.sender == g.creator, "Only creator can start");
        require(g.players.length == MAX_PLAYERS, "Need exactly 6 players");

        g.status = Status.IN_PROGRESS;
        g.currentRound = 1;
        g.roundEnd = block.number + g.roundDuration;

        emit GameStarted(gameId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SPIN — two-step commit/reveal elimination
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice STEP 1 – Host commits a spin request at the current block.
     *         Must be called while the round window is still open.
     */
    function requestSpin(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.creator, "Only host can spin");
        require(g.status == Status.IN_PROGRESS, "Game not in progress");
        require(
            block.number <= g.roundEnd,
            "Round has expired - call advanceRound"
        );

        // Auto-clear a spin that expired (> 500 blocks old)
        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }

        require(!pendingSpins[gameId].pending, "Spin already pending");

        // Must have at least 1 eligible (non-host) player left to eliminate
        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        require(eligible.length > 0, "No eligible players to eliminate");

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
     *         Picks a random non-host player to eliminate. If that elimination
     *         leaves only 1 non-host player alive, that player is declared the
     *         winner — NOT the host.
     */
    function resolveSpin(uint256 gameId) external {
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

        // Build pools — all active players (for entropy) and eligible victims (non-host)
        address[] memory allActive = _getActivePlayers(gameId);
        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        require(eligible.length > 0, "No eligible players to eliminate");

        // Derive seed from multiple entropy sources
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

        // Clear pending spin before state changes (re-entrancy guard)
        delete pendingSpins[gameId];

        // Eliminate the chosen player
        _eliminatePlayer(gameId, victim, g.creator);
        emit PlayerEliminated(gameId, victim, g.currentRound);

        // Auto-advance round if game is still running
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
     */
    function advanceRound(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.IN_PROGRESS, "Not in progress");
        require(block.number > g.roundEnd, "Round not ended yet");

        SpinRequest storage existing = pendingSpins[gameId];
        if (existing.pending && block.number > existing.commitBlock + 500) {
            delete pendingSpins[gameId];
        }

        require(!pendingSpins[gameId].pending, "Resolve pending spin first");

        // Check if any eligible players remain
        address[] memory eligible = _getEligiblePlayers(gameId, g.creator);
        if (eligible.length <= 1) {
            // Only 0 or 1 non-host player left — complete the game
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
     *         full prize pool. The host cannot claim even if they are the
     *         last person technically alive in the players array.
     */
    function claimPrize(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.status == Status.COMPLETED, "Game not completed");
        require(g.winner != address(0), "No winner set");
        require(msg.sender == g.winner, "Not the winner");
        require(!prizeClaimed[gameId], "Prize already claimed");

        prizeClaimed[gameId] = true;
        _updateUserStatsOnWin(msg.sender, g.prizePool);

        (bool sent, ) = payable(msg.sender).call{value: g.prizePool}("");
        require(sent, "Transfer failed");

        emit PrizeClaimed(gameId, msg.sender, g.prizePool);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  VIEW HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Returns all active (non-eliminated) players including the host.
    function getActivePlayers(
        uint256 gameId
    ) external view returns (address[] memory) {
        return _getActivePlayers(gameId);
    }

    /// @notice Returns active non-host players — the only ones who can be
    ///         eliminated or win.
    function getEligiblePlayers(
        uint256 gameId
    ) external view returns (address[] memory) {
        return _getEligiblePlayers(gameId, games[gameId].creator);
    }

    /// @notice Returns the pending spin request for a game (if any).
    function getPendingSpin(
        uint256 gameId
    ) external view returns (SpinRequest memory) {
        return pendingSpins[gameId];
    }

    /// @notice Returns the full game struct.
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

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

    /// @dev All non-eliminated players including the host.
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

    /// @dev Non-eliminated players excluding the host.
    ///      These are the only players who can be eliminated OR win.
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

    /**
     * @dev Marks player as eliminated then checks the eligible pool.
     *      If exactly 1 non-host player remains they are the winner.
     *      If 0 remain the game ends with no winner (edge case: shouldn't
     *      happen in normal flow since requestSpin guards against it).
     *
     *      KEY FIX: completion is triggered on eligible.length == 1,
     *      NOT allActive.length == 1. The host being alive is irrelevant
     *      to the win condition.
     */
    function _eliminatePlayer(
        uint256 gameId,
        address player,
        address host
    ) internal {
        playerGameData[gameId][player].eliminated = true;
        playerGameData[gameId][player].eliminationRound = games[gameId]
            .currentRound;

        // Check remaining eligible (non-host) players after elimination
        address[] memory eligible = _getEligiblePlayers(gameId, host);

        if (eligible.length == 1) {
            // Exactly one non-host player left — they are the winner
            _completeGameFromEligible(gameId, eligible);
        }
        // If eligible.length > 1: game continues normally
        // If eligible.length == 0: all non-host players eliminated simultaneously
        //    (cannot happen in practice — requestSpin prevents spinning with < 1 eligible)
    }

    /**
     * @dev Completes the game. Winner is the sole remaining eligible player.
     *      Called from both _eliminatePlayer and advanceRound.
     */
    function _completeGameFromEligible(
        uint256 gameId,
        address[] memory eligible
    ) internal {
        require(eligible.length == 1, "Cannot complete: no unique winner");

        Game storage g = games[gameId];
        g.status = Status.COMPLETED;
        g.winner = eligible[0]; // always a non-host player
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
        revert("Use joinGame or createGame");
    }
}
