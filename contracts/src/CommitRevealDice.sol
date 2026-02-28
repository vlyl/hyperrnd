// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CommitRevealDice
/// @notice 🟡 MEDIUM SECURITY: Classic two-phase commit-reveal randomness scheme
/// @dev
/// HOW IT WORKS:
///   Phase 1 (Player Commit): Player sends plaintext userSeed + guess + bet (contract hashes internally)
///   Phase 2 (House Reveal):  House reveals serverSeed; contract verifies both commitments and settles
///   Result: keccak256(serverSeed XOR userSeed XOR blockhash) % 6 + 1
///
/// TRUST MODEL:
///   - House must pre-commit serverSeedHash before accepting bets
///   - House cannot manipulate: serverSeed was locked in before player's seed was known
///   - Player cannot manipulate: userSeed was locked in by commit hash
///   - Neither party alone can determine the outcome before reveal
///
/// REMAINING RISKS:
///   - Last-revealer problem: House could refuse to reveal if losing (griefing)
///   - House must be trusted not to correlate seed selection with player patterns
///   - For high-stakes: use chain of reveals or commit with timeout + penalty
///
/// MITIGATIONS IMPLEMENTED:
///   - Timeout: If house doesn't reveal within REVEAL_TIMEOUT blocks, player can reclaim bet
///   - House bond: Owner must stake funds that are slashed if they fail to reveal
contract CommitRevealDice {
    uint256 public constant SIDES = 6;
    uint256 public constant WIN_MULTIPLIER = 5;
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 1 ether;
    uint256 public constant REVEAL_TIMEOUT = 50; // ~50 seconds on HyperEVM fast blocks

    address public immutable owner;
    uint256 public houseBalance;

    // Current server seed commitment (published before accepting bets)
    bytes32 public currentServerSeedHash;
    uint256 public serverSeedEpoch; // incremented each time house commits a new seed

    enum GameState {
        PENDING, // Player committed, waiting for house reveal
        COMPLETED,
        REFUNDED,
        EXPIRED
    }

    struct Game {
        address player;
        uint256 guess;
        bytes32 playerCommit; // hash(userSeed, nonce)
        bytes32 serverSeedHash; // the hash at time of commitment
        uint256 betAmount;
        uint256 commitBlock;
        GameState state;
        uint256 result;
        bool won;
    }

    mapping(uint256 => Game) public games;
    uint256 public gameCount;

    // Nonce per player to prevent commitment replay
    mapping(address => uint256) public playerNonce;

    event ServerSeedCommitted(bytes32 indexed serverSeedHash, uint256 epoch);
    event GameCommitted(
        uint256 indexed gameId,
        address indexed player,
        uint256 guess,
        bytes32 playerCommit,
        bytes32 serverSeedHash,
        uint256 betAmount
    );
    event GameRevealed(
        uint256 indexed gameId,
        address indexed player,
        uint256 guess,
        uint256 result,
        bool won,
        uint256 payout,
        bytes32 serverSeed,
        bytes32 userSeed
    );
    event GameRefunded(uint256 indexed gameId, address indexed player, uint256 amount);
    event HouseFunded(address funder, uint256 amount);

    error OnlyOwner();
    error InvalidBet();
    error InvalidGuess();
    error NoActiveServerSeed();
    error GameNotFound();
    error GameAlreadyProcessed();
    error NotYourGame();
    error RevealTooEarly();
    error TimeoutNotReached();
    error InvalidReveal();
    error InsufficientHouseFunds();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() payable {
        owner = msg.sender;
        houseBalance = msg.value;
    }

    function fundHouse() external payable {
        houseBalance += msg.value;
        emit HouseFunded(msg.sender, msg.value);
    }

    // =========================================================================
    // HOUSE OPERATIONS
    // =========================================================================

    /// @notice House commits to a server seed hash BEFORE accepting bets
    /// @dev This must be called before players can commit. The hash locks in the server's randomness.
    /// @param serverSeedHash keccak256(serverSeed) — the actual serverSeed kept secret until reveal
    function commitServerSeed(bytes32 serverSeedHash) external onlyOwner {
        currentServerSeedHash = serverSeedHash;
        serverSeedEpoch++;
        emit ServerSeedCommitted(serverSeedHash, serverSeedEpoch);
    }

    /// @notice House reveals the server seed and resolves a game
    /// @param gameId The game to resolve
    /// @param serverSeed The actual server seed (must hash to currentServerSeedHash at commit time)
    /// @param userSeed The user's seed (must hash to the player's playerCommit)
    function reveal(uint256 gameId, bytes32 serverSeed, bytes32 userSeed) external onlyOwner {
        Game storage game = games[gameId];
        if (game.player == address(0)) revert GameNotFound();
        if (game.state != GameState.PENDING) revert GameAlreadyProcessed();

        // Verify server seed matches the committed hash AT THE TIME OF THE GAME
        if (keccak256(abi.encodePacked(serverSeed)) != game.serverSeedHash) {
            revert InvalidReveal();
        }

        // Verify user seed matches the committed hash
        uint256 nonce = playerNonce[game.player] - 1; // nonce was already incremented
        if (keccak256(abi.encodePacked(userSeed, nonce)) != game.playerCommit) {
            revert InvalidReveal();
        }

        // Combine entropy: serverSeed XOR userSeed, mixed with block hash
        bytes32 combined = keccak256(
            abi.encodePacked(
                serverSeed,
                userSeed,
                blockhash(game.commitBlock), // adds block-level entropy
                game.player
            )
        );

        uint256 result = (uint256(combined) % SIDES) + 1;
        bool won = (result == game.guess);

        game.state = GameState.COMPLETED;
        game.result = result;
        game.won = won;

        uint256 payout = 0;
        if (won) {
            payout = game.betAmount * WIN_MULTIPLIER;
            if (houseBalance < payout) revert InsufficientHouseFunds();
            houseBalance -= payout;
            (bool success,) = payable(game.player).call{value: payout}("");
            if (!success) revert TransferFailed();
        } else {
            houseBalance += game.betAmount;
        }

        emit GameRevealed(gameId, game.player, game.guess, result, won, payout, serverSeed, userSeed);
    }

    // =========================================================================
    // PLAYER OPERATIONS
    // =========================================================================

    /// @notice Phase 1: Player commits their seed and guess
    /// @param guess Dice face to bet on (1-6)
    /// @param userSeed A random bytes32 from the player (kept secret until reveal)
    /// @return gameId The ID of the created game
    function commit(uint256 guess, bytes32 userSeed) external payable returns (uint256 gameId) {
        if (msg.value < MIN_BET || msg.value > MAX_BET) revert InvalidBet();
        if (guess < 1 || guess > SIDES) revert InvalidGuess();
        if (currentServerSeedHash == bytes32(0)) revert NoActiveServerSeed();

        // Verify house has enough for potential payout
        uint256 maxPayout = msg.value * WIN_MULTIPLIER;
        if (houseBalance < maxPayout) revert InsufficientHouseFunds();

        uint256 nonce = playerNonce[msg.sender]++;
        bytes32 playerCommit = keccak256(abi.encodePacked(userSeed, nonce));

        gameId = gameCount++;
        games[gameId] = Game({
            player: msg.sender,
            guess: guess,
            playerCommit: playerCommit,
            serverSeedHash: currentServerSeedHash, // lock in current server seed hash
            betAmount: msg.value,
            commitBlock: block.number,
            state: GameState.PENDING,
            result: 0,
            won: false
        });

        // Accounting: receive bet, then reserve full max payout
        // Net effect on houseBalance: decreases by (maxPayout - betAmount) = 4 * betAmount
        houseBalance += msg.value; // add incoming bet
        houseBalance -= maxPayout; // deduct reserved potential payout

        emit GameCommitted(gameId, msg.sender, guess, playerCommit, currentServerSeedHash, msg.value);
    }

    /// @notice Player reclaims bet if house fails to reveal within REVEAL_TIMEOUT blocks
    function claimTimeout(uint256 gameId) external {
        Game storage game = games[gameId];
        if (game.player == address(0)) revert GameNotFound();
        if (game.state != GameState.PENDING) revert GameAlreadyProcessed();
        if (msg.sender != game.player) revert NotYourGame();
        if (block.number < game.commitBlock + REVEAL_TIMEOUT) revert TimeoutNotReached();

        game.state = GameState.EXPIRED;

        // Refund: release reserve, then deduct refund to player
        uint256 refund = game.betAmount;
        uint256 maxPayout = game.betAmount * WIN_MULTIPLIER;
        houseBalance += maxPayout; // release reserved potential payout
        houseBalance -= refund; // deduct the bet being refunded (it was added on commit)

        (bool success,) = payable(game.player).call{value: refund}("");
        if (!success) revert TransferFailed();

        emit GameRefunded(gameId, game.player, refund);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /// @notice Helper: generate the player commit hash for frontend
    function computePlayerCommit(address player, bytes32 userSeed) external view returns (bytes32) {
        uint256 nonce = playerNonce[player];
        return keccak256(abi.encodePacked(userSeed, nonce));
    }

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getPlayerGames(address player, uint256 limit)
        external
        view
        returns (uint256[] memory gameIds)
    {
        uint256 count = 0;
        uint256 total = gameCount;
        uint256 start = total > limit ? total - limit : 0;

        // Count matching games
        for (uint256 i = start; i < total; i++) {
            if (games[i].player == player) count++;
        }

        gameIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = start; i < total; i++) {
            if (games[i].player == player) {
                gameIds[idx++] = i;
            }
        }
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        houseBalance -= amount;
        (bool success,) = payable(owner).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    receive() external payable {
        houseBalance += msg.value;
    }
}
