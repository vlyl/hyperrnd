// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IProofOfPlayVRNG.sol";

/// @title MockProofOfPlayVRNG
/// @notice Mock implementation of Proof of Play vRNG for local testing
/// @dev Simulates the PoP vRNG contract behavior.
///      IMPORTANT: In real deployment, callbacks are async (different tx).
///      This mock uses the traceId as requestId to enable sync callback testing,
///      since the game contract stores traceToGame mapping before calling VRF.
contract MockProofOfPlayVRNG is IProofOfPlayVRNG {
    uint256 public requestCounter;

    struct PendingRequest {
        address requester;
        uint256 traceId;
        bool fulfilled;
    }

    mapping(uint256 => PendingRequest) public pendingRequests;

    event RandomnessRequested(uint256 indexed requestId, address indexed requester, uint256 traceId);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomNumber);

    function requestRandomNumberWithTraceId(uint256 traceId)
        external
        override
        returns (uint256 requestId)
    {
        requestId = ++requestCounter;
        pendingRequests[requestId] = PendingRequest({
            requester: msg.sender,
            traceId: traceId,
            fulfilled: false
        });

        emit RandomnessRequested(requestId, msg.sender, traceId);
        // NOTE: No auto-fulfill — call fulfillRequest(requestId) or fulfillAll() manually
        // This ensures requestToGame mapping is set before callback fires
    }

    /// @notice Trigger a specific request's callback
    function fulfillRequest(uint256 requestId) external {
        _fulfill(requestId);
    }

    /// @notice Fulfill all pending requests
    function fulfillAll() external {
        for (uint256 i = 1; i <= requestCounter; i++) {
            if (!pendingRequests[i].fulfilled) {
                _fulfill(i);
            }
        }
    }

    /// @notice Fulfill with a specific random number
    function fulfillWithNumber(uint256 requestId, uint256 randomNumber) external {
        PendingRequest storage req = pendingRequests[requestId];
        require(!req.fulfilled, "Already fulfilled");
        req.fulfilled = true;
        emit RandomnessFulfilled(requestId, randomNumber);
        IVRNGConsumer(req.requester).receiveRandomNumber(requestId, randomNumber);
    }

    function _fulfill(uint256 requestId) internal {
        PendingRequest storage req = pendingRequests[requestId];
        require(!req.fulfilled, "Already fulfilled");
        req.fulfilled = true;

        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    req.traceId, requestId, block.timestamp, block.prevrandao, req.requester
                )
            )
        );

        emit RandomnessFulfilled(requestId, randomNumber);
        IVRNGConsumer(req.requester).receiveRandomNumber(requestId, randomNumber);
    }
}
