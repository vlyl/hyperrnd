// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IProofOfPlayVRNG.sol";

/// @title ProofOfPlayDice
/// @notice 🟢 SECURE: Uses Proof of Play's drand-based vRNG for verifiable randomness
/// @dev
/// HOW PROOF OF PLAY vRNG WORKS:
///   1. Contract calls requestRandomNumberWithTraceId() on PoP vRNG contract
///   2. vRNG service fetches entropy from drand (League of Entropy distributed beacon)
///   3. drand uses threshold BLS signatures from 16+ independent organizations
///      (Protocol Labs, Cloudflare, EPFL, Kudelski, etc.)
///   4. vRNG service calls receiveRandomNumber() callback within ~1-3 seconds
///
/// DRAND SECURITY:
///   - Requires 1/3+ of threshold signers to collude to bias output
///   - Operates on a public verifiable ledger
///   - No single party controls the output
///   - Publicly verifiable randomness beacon
///
/// DEPLOYMENT: 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1 (HyperEVM mainnet)
/// NOTE: Requires whitelist registration at https://docs.proofofplay.com/services/vrng/about
contract ProofOfPlayDice is IVRNGConsumer {
    uint256 public constant SIDES = 6;
    uint256 public constant WIN_MULTIPLIER = 5;
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 1 ether;

    IProofOfPlayVRNG public immutable vrng;
    address public immutable vrngCallbackSender; // authorized to call receiveRandomNumber
    address public immutable owner;
    uint256 public houseBalance;

    enum GameState {
        PENDING,
        COMPLETED
    }

    struct Game {
        address player;
        uint256 guess;
        uint256 betAmount;
        GameState state;
        uint256 result;
        bool won;
        uint256 randomNumber; // Raw drand output
        uint256 traceId; // Our internal trace ID
        uint256 requestBlock;
    }

    // PoP requestId -> gameId
    mapping(uint256 => uint256) public requestToGame;
    // traceId -> gameId (for frontend tracking)
    mapping(uint256 => uint256) public traceToGame;
    mapping(uint256 => Game) public games;
    uint256 public gameCount;
    uint256 public traceCounter;

    event GameRequested(
        uint256 indexed gameId,
        uint256 indexed requestId,
        uint256 indexed traceId,
        address player,
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
        uint256 randomNumber
    );
    event HouseFunded(address funder, uint256 amount);

    error OnlyOwner();
    error OnlyVRNG();
    error InvalidBet();
    error InvalidGuess();
    error InsufficientHouseFunds();
    error GameAlreadyProcessed();
    error GameNotFound();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @param _vrng Address of Proof of Play vRNG contract
    /// @param _vrngCallbackSender Address authorized to send callbacks (PoP's relay address)
    constructor(address _vrng, address _vrngCallbackSender) payable {
        vrng = IProofOfPlayVRNG(_vrng);
        vrngCallbackSender = _vrngCallbackSender;
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

    /// @notice Request a dice roll using Proof of Play drand VRF
    /// @param guess Your guess (1-6)
    /// @return gameId Your game ID (resolves asynchronously via callback)
    function requestRoll(uint256 guess) external payable returns (uint256 gameId) {
        if (msg.value < MIN_BET || msg.value > MAX_BET) revert InvalidBet();
        if (guess < 1 || guess > SIDES) revert InvalidGuess();

        uint256 maxPayout = msg.value * WIN_MULTIPLIER;
        if (houseBalance < maxPayout) revert InsufficientHouseFunds();

        // Reserve potential payout
        houseBalance += msg.value;
        houseBalance -= maxPayout;

        // Create unique trace ID for this game
        uint256 traceId = ++traceCounter;

        // CEI: store game data BEFORE calling VRF (which may callback synchronously in tests)
        gameId = gameCount++;
        games[gameId] = Game({
            player: msg.sender,
            guess: guess,
            betAmount: msg.value,
            state: GameState.PENDING,
            result: 0,
            won: false,
            randomNumber: 0,
            traceId: traceId,
            requestBlock: block.number
        });
        traceToGame[traceId] = gameId;

        // Request randomness — callback may arrive async (or sync in mocks)
        uint256 requestId = vrng.requestRandomNumberWithTraceId(traceId);

        // Map requestId after VRF call (safe if callback is async; redundant if sync)
        requestToGame[requestId] = gameId;

        emit GameRequested(gameId, requestId, traceId, msg.sender, guess, msg.value);
    }

    // =========================================================================
    // vRNG CALLBACK
    // =========================================================================

    /// @notice Called by Proof of Play vRNG service when randomness is ready
    /// @dev Only the authorized vRNG callback sender can call this
    function receiveRandomNumber(uint256 requestId, uint256 randomNumber) external override {
        if (msg.sender != vrngCallbackSender) revert OnlyVRNG();

        uint256 gameId = requestToGame[requestId];
        Game storage game = games[gameId];

        if (game.player == address(0)) revert GameNotFound();
        if (game.state != GameState.PENDING) revert GameAlreadyProcessed();

        // Domain-separated derivation: prevents correlation between games sharing the same
        // drand round (~3s window). Each game gets a unique hash even with same randomNumber.
        uint256 derived = uint256(keccak256(abi.encodePacked(
            randomNumber,
            requestId,
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
            houseBalance -= payout;
            (bool success,) = payable(game.player).call{value: payout}("");
            if (!success) revert TransferFailed();
        } else {
            houseBalance += maxPayout; // release reserve — house keeps bet
        }

        emit GameResolved(gameId, game.player, game.guess, result, won, payout, randomNumber);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getGameByTrace(uint256 traceId) external view returns (Game memory) {
        return games[traceToGame[traceId]];
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
