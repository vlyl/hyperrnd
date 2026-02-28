// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IEntropy.sol";

/// @title MockEntropy
/// @notice Mock implementation of Pyth Entropy for local testing
/// @dev Auto-fulfills callbacks synchronously.
///      PythEntropyDice stores game data BEFORE calling requestWithCallback,
///      so sync callbacks work correctly (sequenceToGame is set after callback,
///      but entropyCallback uses sequenceNumber which is returned from this mock).
///
///      Since we auto-fulfill INSIDE requestWithCallback, PythEntropyDice's
///      sequenceToGame[seq] = gameId line runs AFTER entropyCallback.
///      To handle this, PythEntropyDice pre-stores game data before the VRF call
///      and uses gameCount-1 as a fallback lookup in the callback.
contract MockEntropy is IEntropy {
    address public defaultProvider;
    uint128 public fee;
    uint64 public sequenceCounter;
    uint64 public lastSequenceNumber; // track last issued sequence for game lookup

    struct PendingRequest {
        address requester;
        address provider;
        bytes32 userRandomNumber;
        bool fulfilled;
    }

    mapping(uint64 => PendingRequest) public pendingRequests;

    event RandomnessRequested(
        uint64 indexed sequenceNumber, address indexed requester, bytes32 userRandomNumber
    );
    event RandomnessFulfilled(uint64 indexed sequenceNumber, bytes32 randomNumber);

    constructor(address _defaultProvider, uint128 _fee) {
        defaultProvider = _defaultProvider;
        fee = _fee;
    }

    function requestWithCallback(address provider, bytes32 userRandomNumber)
        external
        payable
        override
        returns (uint64 sequenceNumber)
    {
        require(msg.value >= fee, "Insufficient fee");

        sequenceNumber = ++sequenceCounter;
        lastSequenceNumber = sequenceNumber;

        pendingRequests[sequenceNumber] = PendingRequest({
            requester: msg.sender,
            provider: provider,
            userRandomNumber: userRandomNumber,
            fulfilled: false
        });

        emit RandomnessRequested(sequenceNumber, msg.sender, userRandomNumber);

        // Auto-fulfill synchronously
        _fulfillRequest(sequenceNumber);
        // Note: PythEntropyDice.sequenceToGame[seq] = gameId is set AFTER this returns,
        // but the callback already processed the game using the pre-stored game data.
    }

    /// @notice Manually trigger a callback with auto-generated randomness
    function fulfillRequest(uint64 sequenceNumber) external {
        _fulfillRequest(sequenceNumber);
    }

    /// @notice Manually trigger with specific random number
    function fulfillWithNumber(uint64 sequenceNumber, bytes32 randomNumber) external {
        _fulfillWithNumber(sequenceNumber, randomNumber);
    }

    function _fulfillRequest(uint64 sequenceNumber) internal {
        PendingRequest storage req = pendingRequests[sequenceNumber];
        bytes32 randomNumber = keccak256(
            abi.encodePacked(
                req.userRandomNumber, sequenceNumber, block.timestamp, block.prevrandao
            )
        );
        _fulfillWithNumber(sequenceNumber, randomNumber);
    }

    function _fulfillWithNumber(uint64 sequenceNumber, bytes32 randomNumber) internal {
        PendingRequest storage req = pendingRequests[sequenceNumber];
        require(!req.fulfilled, "Already fulfilled");
        req.fulfilled = true;

        emit RandomnessFulfilled(sequenceNumber, randomNumber);

        IEntropyConsumer(req.requester).entropyCallback(
            sequenceNumber, req.provider, randomNumber
        );
    }

    function getFee(address) external view override returns (uint128) {
        return fee;
    }

    function getDefaultProvider() external view override returns (address) {
        return defaultProvider;
    }

    function setFee(uint128 _fee) external {
        fee = _fee;
    }
}
