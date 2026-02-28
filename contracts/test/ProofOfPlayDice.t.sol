// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProofOfPlayDice.sol";
import "../src/mocks/MockProofOfPlayVRNG.sol";

contract ProofOfPlayDiceTest is Test {
    MockProofOfPlayVRNG mockVRNG;
    ProofOfPlayDice dice;

    address owner = makeAddr("owner");
    address player = makeAddr("player");

    uint256 constant HOUSE_FUND = 10 ether;
    uint256 constant BET = 0.01 ether;

    function setUp() public {
        mockVRNG = new MockProofOfPlayVRNG();

        vm.deal(owner, 100 ether);
        vm.prank(owner);
        // vrngCallbackSender = address(this) (test contract calls mockVRNG.fulfillRequest)
        // Actually the mock's _fulfill calls receiveRandomNumber on dice,
        // so callback sender is the mock itself
        dice = new ProofOfPlayDice{value: HOUSE_FUND}(address(mockVRNG), address(mockVRNG));

        vm.deal(player, 1 ether);
    }

    function test_RequestRoll() public {
        vm.prank(player);
        uint256 gameId = dice.requestRoll{value: BET}(4);

        // Game should be pending before fulfillment
        ProofOfPlayDice.Game memory game = dice.getGame(gameId);
        assertEq(uint8(game.state), uint8(ProofOfPlayDice.GameState.PENDING));

        // Fulfill the VRF request
        uint256 requestId = mockVRNG.requestCounter();
        mockVRNG.fulfillRequest(requestId);

        // Now game should be completed
        game = dice.getGame(gameId);
        assertEq(uint8(game.state), uint8(ProofOfPlayDice.GameState.COMPLETED));
        assertTrue(game.result >= 1 && game.result <= 6);
    }

    function test_TraceIdMapping() public {
        vm.prank(player);
        uint256 gameId = dice.requestRoll{value: BET}(2);

        uint256 requestId = mockVRNG.requestCounter();
        mockVRNG.fulfillRequest(requestId);

        ProofOfPlayDice.Game memory game = dice.getGame(gameId);
        ProofOfPlayDice.Game memory gameByTrace = dice.getGameByTrace(game.traceId);

        assertEq(gameByTrace.player, player);
        assertEq(gameByTrace.guess, 2);
    }

    function test_MultipleSimultaneousRequests() public {
        address player2 = makeAddr("player2");
        vm.deal(player2, 1 ether);

        vm.prank(player);
        uint256 gameId1 = dice.requestRoll{value: BET}(1);

        vm.prank(player2);
        uint256 gameId2 = dice.requestRoll{value: BET}(2);

        // Fulfill both requests
        mockVRNG.fulfillAll();

        ProofOfPlayDice.Game memory game1 = dice.getGame(gameId1);
        ProofOfPlayDice.Game memory game2 = dice.getGame(gameId2);

        assertEq(uint8(game1.state), uint8(ProofOfPlayDice.GameState.COMPLETED));
        assertEq(uint8(game2.state), uint8(ProofOfPlayDice.GameState.COMPLETED));
        assertEq(game1.player, player);
        assertEq(game2.player, player2);
    }

    function test_OnlyVRNGCanCallback() public {
        vm.prank(player);
        vm.expectRevert(ProofOfPlayDice.OnlyVRNG.selector);
        dice.receiveRandomNumber(1, 12345);
    }

    function test_InvalidGuessReverts() public {
        vm.prank(player);
        vm.expectRevert(ProofOfPlayDice.InvalidGuess.selector);
        dice.requestRoll{value: BET}(0);
    }

    function test_InsufficientBetReverts() public {
        vm.prank(player);
        vm.expectRevert(ProofOfPlayDice.InvalidBet.selector);
        dice.requestRoll{value: 0.0001 ether}(3);
    }

    function test_HouseBalanceAccounting() public {
        uint256 initialBalance = dice.houseBalance();

        for (uint256 i = 0; i < 6; i++) {
            vm.prank(player);
            dice.requestRoll{value: BET}((i % 6) + 1);
        }

        // Fulfill all
        mockVRNG.fulfillAll();

        uint256 finalBalance = dice.houseBalance();
        console.log("Initial house balance:", initialBalance);
        console.log("Final house balance:", finalBalance);
        // Balance should be tracked correctly (positive after losses, lower after wins)
        assertTrue(finalBalance <= initialBalance + 6 * BET, "Balance accounting error");
    }

    function test_RandomDistribution() public {
        uint256[7] memory counts;

        for (uint256 i = 0; i < 60; i++) {
            vm.roll(block.number + i);
            vm.warp(block.timestamp + i);

            vm.prank(player);
            dice.requestRoll{value: BET}(1);
        }

        // Fulfill all at once
        mockVRNG.fulfillAll();

        // Check distribution by reading completed games
        for (uint256 i = 0; i < 60; i++) {
            ProofOfPlayDice.Game memory game = dice.getGame(i);
            if (game.result >= 1 && game.result <= 6) {
                counts[game.result]++;
            }
        }

        console.log("Distribution over 60 rolls:");
        for (uint256 i = 1; i <= 6; i++) {
            console.log("  Face %d: %d times", i, counts[i]);
        }

        // Rough fairness check
        for (uint256 i = 1; i <= 6; i++) {
            assertTrue(counts[i] > 2, "Face appeared too rarely");
            assertTrue(counts[i] < 25, "Face appeared too frequently");
        }
    }

    function test_WinnerGetsPaid() public {
        // Find a guess that wins
        uint256 winGuess = _previewResult(1);

        uint256 playerBefore = player.balance;
        vm.prank(player);
        uint256 gameId = dice.requestRoll{value: BET}(winGuess);

        mockVRNG.fulfillAll();

        ProofOfPlayDice.Game memory game = dice.getGame(gameId);
        if (game.won) {
            assertEq(player.balance, playerBefore - BET + BET * 5);
        } else {
            assertEq(player.balance, playerBefore - BET);
        }
    }

    /// @dev Preview what result would be for requestId=1 to find a winning guess
    function _previewResult(uint256 traceId) internal view returns (uint256) {
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(traceId, uint256(1), block.timestamp, block.prevrandao, address(dice))
            )
        );
        return (randomNumber % 6) + 1;
    }
}
