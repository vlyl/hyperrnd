// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BlockRandomnessDice.sol";
import "../src/CommitRevealDice.sol";
import "../src/PythEntropyDice.sol";
import "../src/ProofOfPlayDice.sol";
import "../src/mocks/MockEntropy.sol";
import "../src/mocks/MockProofOfPlayVRNG.sol";

/// @title DeployLocal
/// @notice Deploy all contracts to local anvil fork of HyperEVM
/// @dev Uses mock VRF providers for local testing
///      Run: forge script script/Deploy.s.sol --rpc-url local --broadcast --private-key $PK
contract DeployLocal is Script {
    // House funding: 10 HYPE each
    uint256 constant HOUSE_FUND = 10 ether;

    function run() external {
        address deployer = msg.sender; // derived from --private-key flag

        console.log("=== HyperEVM RNG Demo - Local Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast();

        // 1. Deploy Block Randomness Dice (no dependencies)
        BlockRandomnessDice blockDice = new BlockRandomnessDice{value: HOUSE_FUND}();
        console.log("BlockRandomnessDice:", address(blockDice));

        // 2. Deploy Commit-Reveal Dice
        CommitRevealDice commitDice = new CommitRevealDice{value: HOUSE_FUND}();
        console.log("CommitRevealDice:", address(commitDice));

        // Pre-commit server seed (use a deterministic one for local testing)
        bytes32 initialServerSeed = keccak256("local-test-server-seed-epoch-1");
        bytes32 serverSeedHash = keccak256(abi.encodePacked(initialServerSeed));
        commitDice.commitServerSeed(serverSeedHash);
        console.log("CommitReveal: server seed committed");
        console.log("  Seed hash:", vm.toString(serverSeedHash));
        console.log("  (Keep server seed secret: store securely)");

        // 3. Deploy Mock Entropy (Pyth replacement for local)
        address mockProvider = deployer; // deployer acts as provider
        uint128 entropyFee = 0.001 ether;
        MockEntropy mockEntropy = new MockEntropy(mockProvider, entropyFee);
        console.log("MockEntropy:", address(mockEntropy));

        // 4. Deploy Pyth Entropy Dice using mock
        PythEntropyDice pythDice =
            new PythEntropyDice{value: HOUSE_FUND}(address(mockEntropy), mockProvider);
        console.log("PythEntropyDice:", address(pythDice));

        // 5. Deploy Mock Proof of Play vRNG
        MockProofOfPlayVRNG mockVRNG = new MockProofOfPlayVRNG();
        console.log("MockProofOfPlayVRNG:", address(mockVRNG));

        // 6. Deploy Proof of Play Dice using mock
        ProofOfPlayDice popDice =
            new ProofOfPlayDice{value: HOUSE_FUND}(address(mockVRNG), address(mockVRNG));
        console.log("ProofOfPlayDice:", address(popDice));

        vm.stopBroadcast();

        // Output deployment addresses as JSON for frontend
        string memory json = string.concat(
            '{\n',
            '  "network": "local",\n',
            '  "chainId": 31337,\n',
            '  "blockRandomnessDice": "', vm.toString(address(blockDice)), '",\n',
            '  "commitRevealDice": "', vm.toString(address(commitDice)), '",\n',
            '  "pythEntropyDice": "', vm.toString(address(pythDice)), '",\n',
            '  "proofOfPlayDice": "', vm.toString(address(popDice)), '",\n',
            '  "mockEntropy": "', vm.toString(address(mockEntropy)), '",\n',
            '  "mockVRNG": "', vm.toString(address(mockVRNG)), '",\n',
            '  "serverSeedHash": "', vm.toString(serverSeedHash), '",\n',
            '  "note": "For local testing only. MockEntropy auto-fulfills callbacks in same tx."\n',
            '}'
        );

        vm.writeFile("../frontend/public/deployments.local.json", json);
        console.log("\n=== Deployment addresses written to frontend/src/contracts/deployments.local.json ===");
    }
}

/// @title DeployMainnet
/// @notice Deploy to HyperEVM mainnet using real VRF providers
/// @dev Requires PYTH_ENTROPY_ADDRESS and are registered with Proof of Play
///      Run: forge script script/Deploy.s.sol:DeployMainnet --rpc-url hyperevm --broadcast
contract DeployMainnet is Script {
    // HyperEVM Mainnet addresses
    // Find Pyth Entropy address at: https://entropy-explorer.pyth.network/ (chain 999)
    address constant PYTH_ENTROPY = 0x0000000000000000000000000000000000000000; // TODO: set real address
    address constant PYTH_DEFAULT_PROVIDER = 0x0000000000000000000000000000000000000000; // TODO

    // Proof of Play vRNG: already deployed on HyperEVM mainnet
    address constant POP_VRNG = 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1;
    address constant POP_CALLBACK_SENDER = 0x0000000000000000000000000000000000000000; // TODO: PoP relay

    uint256 constant HOUSE_FUND = 5 ether;

    function run() external {
        require(PYTH_ENTROPY != address(0), "Set PYTH_ENTROPY address first");
        require(POP_CALLBACK_SENDER != address(0), "Set POP_CALLBACK_SENDER address first");

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== HyperEVM RNG Demo - Mainnet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        BlockRandomnessDice blockDice = new BlockRandomnessDice{value: HOUSE_FUND}();
        CommitRevealDice commitDice = new CommitRevealDice{value: HOUSE_FUND}();

        bytes32 initialServerSeed = bytes32(vm.envBytes32("SERVER_SEED"));
        commitDice.commitServerSeed(keccak256(abi.encodePacked(initialServerSeed)));

        PythEntropyDice pythDice =
            new PythEntropyDice{value: HOUSE_FUND}(PYTH_ENTROPY, PYTH_DEFAULT_PROVIDER);

        ProofOfPlayDice popDice =
            new ProofOfPlayDice{value: HOUSE_FUND}(POP_VRNG, POP_CALLBACK_SENDER);

        vm.stopBroadcast();

        console.log("BlockRandomnessDice:", address(blockDice));
        console.log("CommitRevealDice:", address(commitDice));
        console.log("PythEntropyDice:", address(pythDice));
        console.log("ProofOfPlayDice:", address(popDice));
    }
}
