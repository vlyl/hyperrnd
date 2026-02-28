// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Pyth Entropy Interface
/// @notice Interface for requesting verifiable randomness from Pyth Network
/// @dev See https://docs.pyth.network/entropy
interface IEntropy {
    /// @notice Request a random number with a callback
    /// @param provider The entropy provider address
    /// @param userRandomNumber A random number contributed by the user (commit phase)
    /// @return sequenceNumber Unique ID for this request
    function requestWithCallback(address provider, bytes32 userRandomNumber)
        external
        payable
        returns (uint64 sequenceNumber);

    /// @notice Get the fee required for a random number request
    /// @param provider The entropy provider address
    /// @return feeAmount The fee in native token (wei)
    function getFee(address provider) external view returns (uint128 feeAmount);

    /// @notice Get the default provider address
    function getDefaultProvider() external view returns (address provider);
}

/// @title Pyth Entropy Consumer Interface
/// @notice Implement this interface to receive entropy callbacks
interface IEntropyConsumer {
    /// @notice Called by Pyth Entropy when randomness is ready
    /// @param sequenceNumber The request ID returned from requestWithCallback
    /// @param provider The entropy provider
    /// @param randomNumber The verifiable random number
    function entropyCallback(uint64 sequenceNumber, address provider, bytes32 randomNumber) external;

    /// @notice Return the address of the Entropy contract
    /// @dev Must return the address of the Entropy contract that will call entropyCallback
    function getEntropy() external view returns (address);
}
