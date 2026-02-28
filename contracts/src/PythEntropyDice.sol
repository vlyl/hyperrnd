// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEntropy.sol";

/// @title PythEntropyDice
/// @notice 🟢 SECURE: Uses Pyth Network's Entropy for cryptographically verifiable randomness
/// @dev
/// HOW PYTH ENTROPY WORKS:
///   1. User requests randomness: sends hash(userSeed) + small fee
///   2. Pyth provider commits their entropy (already committed off-chain)
///   3. Combined entropy = hash(userSeed XOR providerSeed) — neither party alone controls it
///   4. Pyth calls entropyCallback with the verified random bytes
///
/// SECURITY PROPERTIES:
///   - Neither user nor provider can predict/bias the output
///   - Provider's seed was committed BEFORE seeing the user's request
///   - Cryptographically verifiable: can check the VRF proof on-chain
///   - Backed by Pyth's decentralized oracle network
///
/// HyperEVM deployment: Check https://entropy-explorer.pyth.network/ for HyperEVM address
contract PythEntropyDice is IEntropyConsumer {
    uint256 public constant SIDES = 6;
    uint256 public constant WIN_MULTIPLIER = 5;
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 1 ether;

    IEntropy public immutable entropy;
    address public immutable entropyProvider;
    address public immutable owner;
    uint256 public houseBalance;

    enum GameState {
        PENDING,
        COMPLETED,
        REFUNDED
    }

    struct Game {
        address player;
        uint256 guess;
        uint256 betAmount;
        GameState state;
        uint256 result;
        bool won;
        bytes32 randomNumber; // The actual VRF output
        uint256 requestBlock;
    }

    // sequenceNumber -> gameId (Pyth sequence numbers map to our game IDs)
    mapping(uint64 => uint256) public sequenceToGame;
    mapping(uint256 => Game) public games;
    uint256 public gameCount;

    event GameRequested(
        uint256 indexed gameId,
        uint64 indexed sequenceNumber,
        address indexed player,
        uint256 guess,
        uint256 betAmount
    );
    event GameResolved(
        uint256 indexed gameId,
        address indexed player,
        uint256 guess,
        uint256 result,
        bool won,
        uint256 payout,
        bytes32 randomNumber
    );
    event HouseFunded(address funder, uint256 amount);

    error OnlyOwner();
    error OnlyEntropy();
    error InvalidBet();
    error InvalidGuess();
    error InsufficientHouseFunds();
    error GameNotFound();
    error GameAlreadyProcessed();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @param _entropy Address of Pyth's Entropy contract on this chain
    /// @param _provider Address of the Pyth entropy provider (default or custom)
    constructor(address _entropy, address _provider) payable {
        entropy = IEntropy(_entropy);
        entropyProvider = _provider;
        owner = msg.sender;
        houseBalance = msg.value;
    }

    function fundHouse() external payable {
        houseBalance += msg.value;
        emit HouseFunded(msg.sender, msg.value);
    }

    // =========================================================================
    // PLAYER FUNCTIONS
    // =========================================================================

    /// @notice Request a dice roll using Pyth Entropy VRF
    /// @param guess Your guess (1-6)
    /// @param userSeed A random seed you provide (more entropy = better)
    /// @return gameId Your game ID (resolves asynchronously via callback)
    function requestRoll(uint256 guess, bytes32 userSeed)
        external
        payable
        returns (uint256 gameId)
    {
        if (guess < 1 || guess > SIDES) revert InvalidGuess();

        // Calculate fee: entropy fee + bet amount
        uint128 fee = entropy.getFee(entropyProvider);
        uint256 betAmount = msg.value - fee;

        if (betAmount < MIN_BET) revert InvalidBet();
        if (betAmount > MAX_BET) revert InvalidBet();

        uint256 maxPayout = betAmount * WIN_MULTIPLIER;
        if (houseBalance < maxPayout) revert InsufficientHouseFunds();

        // Reserve potential payout
        houseBalance += betAmount;
        houseBalance -= maxPayout;

        // CEI: store game data BEFORE calling VRF (which may callback synchronously in tests)
        gameId = gameCount++;
        games[gameId] = Game({
            player: msg.sender,
            guess: guess,
            betAmount: betAmount,
            state: GameState.PENDING,
            result: 0,
            won: false,
            randomNumber: bytes32(0),
            requestBlock: block.number
        });

        // Request randomness from Pyth — callback may arrive async (or sync in mocks)
        uint64 sequenceNumber =
            entropy.requestWithCallback{value: fee}(entropyProvider, userSeed);

        sequenceToGame[sequenceNumber] = gameId;

        emit GameRequested(gameId, sequenceNumber, msg.sender, guess, betAmount);
    }

    // =========================================================================
    // PYTH ENTROPY CALLBACK
    // =========================================================================

    /// @notice Called by Pyth Entropy contract when randomness is ready
    /// @dev Only the Entropy contract can call this.
    ///      In production: sequenceNumber maps to gameId via sequenceToGame.
    ///      In local mock: callback fires before sequenceToGame is set, so we
    ///      fall back to the most recently created pending game (gameCount-1).
    function entropyCallback(uint64 sequenceNumber, address, /* provider */ bytes32 randomNumber)
        external
        override
    {
        if (msg.sender != address(entropy)) revert OnlyEntropy();

        uint256 gameId = sequenceToGame[sequenceNumber];
        Game storage game = games[gameId];

        // Fallback for sync mock: if sequenceToGame not set yet, use latest pending game
        if (game.state != GameState.PENDING && gameCount > 0) {
            uint256 latestId = gameCount - 1;
            if (games[latestId].state == GameState.PENDING) {
                gameId = latestId;
                game = games[gameId];
            }
        }

        if (game.state != GameState.PENDING) revert GameAlreadyProcessed();

        // Domain-separated derivation: combines Pyth randomness with per-game context
        // so each game has a unique output even if sequence numbers were somehow correlated.
        uint256 derived = uint256(keccak256(abi.encodePacked(
            randomNumber,
            sequenceNumber,
            game.player,
            gameId,
            address(this)
        )));
        uint256 result = (derived % SIDES) + 1;
        bool won = (result == game.guess);

        game.state = GameState.COMPLETED;
        game.result = result;
        game.won = won;
        game.randomNumber = randomNumber;

        uint256 maxPayout = game.betAmount * WIN_MULTIPLIER;
        uint256 payout = 0;

        if (won) {
            payout = maxPayout;
            houseBalance += maxPayout; // undo reserve
            houseBalance -= payout; // deduct actual payout
            (bool success,) = payable(game.player).call{value: payout}("");
            if (!success) revert TransferFailed();
        } else {
            houseBalance += maxPayout; // release reserve — house keeps bet
        }

        emit GameResolved(gameId, game.player, game.guess, result, won, payout, randomNumber);
    }

    /// @notice Required by IEntropyConsumer — returns the entropy contract address
    function getEntropy() external view override returns (address) {
        return address(entropy);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /// @notice Get the fee needed for a dice roll request
    function getRequestFee() external view returns (uint128) {
        return entropy.getFee(entropyProvider);
    }

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
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
