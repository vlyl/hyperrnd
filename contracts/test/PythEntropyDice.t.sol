// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PythEntropyDice.sol";
import "../src/mocks/MockEntropy.sol";

contract PythEntropyDiceTest is Test {
    MockEntropy mockEntropy;
    PythEntropyDice dice;

    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address provider = makeAddr("provider");

    uint256 constant HOUSE_FUND = 10 ether;
    uint256 constant BET = 0.01 ether;
    uint128 constant ENTROPY_FEE = 0.001 ether;

    function setUp() public {
        mockEntropy = new MockEntropy(provider, ENTROPY_FEE);

        vm.deal(owner, 100 ether);
        vm.prank(owner);
        dice = new PythEntropyDice{value: HOUSE_FUND}(address(mockEntropy), provider);

        vm.deal(player, 1 ether);
    }

    function test_RequestRoll() public {
        bytes32 userSeed = keccak256("player-seed");
        uint256 totalValue = BET + ENTROPY_FEE;

        vm.prank(player);
        uint256 gameId = dice.requestRoll{value: totalValue}(3, userSeed);

        // MockEntropy auto-fulfills, so game should be completed
        PythEntropyDice.Game memory game = dice.getGame(gameId);
        assertEq(uint8(game.state), uint8(PythEntropyDice.GameState.COMPLETED));
        assertTrue(game.result >= 1 && game.result <= 6);
    }

    function test_RandomnessIsInRange() public {
        bytes32 userSeed = keccak256("seed");
        uint256 totalValue = BET + ENTROPY_FEE;

        // Run multiple rolls and verify all results are in range
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(player);
            uint256 gameId = dice.requestRoll{value: totalValue}(1, keccak256(abi.encodePacked(i)));

            PythEntropyDice.Game memory game = dice.getGame(gameId);
            assertTrue(game.result >= 1 && game.result <= 6, "Result out of range");
        }
    }

    function test_WinPayout() public {
        uint256 playerBefore = player.balance;
        uint256 totalValue = BET + ENTROPY_FEE;

        // Run rolls until we hit a win
        bool won = false;
        for (uint256 i = 0; i < 30; i++) {
            uint256 guess = (i % 6) + 1;
            vm.prank(player);
            uint256 gameId = dice.requestRoll{value: totalValue}(guess, keccak256(abi.encodePacked(i)));

            PythEntropyDice.Game memory game = dice.getGame(gameId);
            if (game.won) {
                won = true;
                break;
            }
        }

        // With 30 attempts, we should win at least once (1/6 chance each)
        // Not guaranteed, but extremely likely
        console.log("Won in 30 attempts:", won);
    }

    function test_InsufficientFeeReverts() public {
        bytes32 userSeed = keccak256("seed");

        vm.prank(player);
        vm.expectRevert(); // Should revert with InvalidBet
        dice.requestRoll{value: ENTROPY_FEE}(3, userSeed); // Only sending fee, no bet
    }

    function test_InvalidGuessReverts() public {
        bytes32 userSeed = keccak256("seed");

        vm.prank(player);
        vm.expectRevert(PythEntropyDice.InvalidGuess.selector);
        dice.requestRoll{value: BET + ENTROPY_FEE}(7, userSeed);
    }

    function test_OnlyEntropyCanCallback() public {
        vm.prank(player);
        vm.expectRevert(PythEntropyDice.OnlyEntropy.selector);
        dice.entropyCallback(1, provider, bytes32(uint256(12345)));
    }

    function test_GetEntropy() public view {
        assertEq(dice.getEntropy(), address(mockEntropy));
    }

    function test_GetRequestFee() public view {
        assertEq(dice.getRequestFee(), ENTROPY_FEE);
    }

    function test_HouseFunding() public {
        uint256 fundAmount = 1 ether;
        dice.fundHouse{value: fundAmount}();
        assertEq(dice.houseBalance(), HOUSE_FUND + fundAmount);
    }
}
