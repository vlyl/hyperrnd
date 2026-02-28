// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Proof of Play vRNG Interface
/// @notice Interface for Proof of Play's drand-based VRF service on HyperEVM
/// @dev Deployed at 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1 on HyperEVM mainnet
/// @dev See https://docs.proofofplay.com/services/vrng/about
interface IProofOfPlayVRNG {
    /// @notice Request a random number with a trace ID for correlation
    /// @param traceId User-defined identifier to correlate the request with the callback
    /// @return requestId Unique ID assigned by the vRNG service
    function requestRandomNumberWithTraceId(uint256 traceId) external returns (uint256 requestId);
}

/// @title Proof of Play vRNG Consumer Interface
/// @notice Implement this interface in your contract to receive vRNG callbacks
interface IVRNGConsumer {
    /// @notice Called by the vRNG service when a random number is ready
    /// @param requestId The ID returned from requestRandomNumberWithTraceId
    /// @param randomNumber The drand-sourced verified random number
    function receiveRandomNumber(uint256 requestId, uint256 randomNumber) external;
}
