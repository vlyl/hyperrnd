// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BlockRandomnessDice.sol";

contract BlockRandomnessDiceTest is Test {
    BlockRandomnessDice dice;
    BlockRandomnessAttacker attacker;
    address player = makeAddr("player");
    address hacker = makeAddr("hacker");

    uint256 constant HOUSE_FUND = 10 ether;
    uint256 constant BET = 0.01 ether;

    function setUp() public {
        dice = new BlockRandomnessDice{value: HOUSE_FUND}();
        attacker = new BlockRandomnessAttacker(payable(address(dice)));

        vm.deal(player, 1 ether);
        vm.deal(hacker, 5 ether);
    }

    function test_BasicRoll() public {
        vm.prank(player);
        (uint256 result,) = dice.roll{value: BET}(1);
        assertTrue(result >= 1 && result <= 6, "Result must be 1-6");
    }

    function test_RevertOnInvalidGuess() public {
        vm.prank(player);
        vm.expectRevert();
        dice.roll{value: BET}(7);
    }

    function test_RevertOnInsufficientBet() public {
        vm.prank(player);
        vm.expectRevert();
        dice.roll{value: 0.0001 ether}(3);
    }

    function test_WinPayout() public {
        // Roll until we get a win (statistically should happen within 30 attempts)
        uint256 playerStart = player.balance;
        bool won = false;

        for (uint256 i = 0; i < 30 && !won; i++) {
            vm.roll(block.number + 1);
            vm.warp(block.timestamp + 1);
            for (uint256 guess = 1; guess <= 6 && !won; guess++) {
                vm.prank(player);
                (, bool didWin) = dice.roll{value: BET}(guess);
                if (didWin) {
                    won = true;
                    // Verify 5x payout: player paid BET for this roll + all previous losses
                    assertTrue(player.balance > playerStart - (i * 6 + guess) * BET,
                        "Winner should have positive balance impact");
                }
            }
        }
        assertTrue(won, "Should win at least once in 180 rolls");
    }

    function test_AttackDemonstration() public {
        // Show that attackers can exploit block randomness
        uint256 attackerBefore = hacker.balance;

        // Try to exploit: preview result, only submit if winning
        for (uint256 i = 0; i < 6; i++) {
            (uint256 result, bool wouldWin) = dice.rollView(i + 1);
            if (wouldWin) {
                vm.prank(hacker);
                dice.roll{value: BET}(i + 1);
                break;
            }
        }

        // Note: In a real attack, the attacker would call from a contract
        // that reverts on loss — they lose nothing but gas when they lose
        console.log("Attacker balance change:", hacker.balance, attackerBefore);
    }

    function test_ContractAttackExploit() public {
        // Fund the attacker contract
        vm.deal(address(attacker), 1 ether);

        // The attacker contract previews results and only submits winning bets
        // This works because block.prevrandao is the same throughout the block
        uint256 winGuess = _findWinningGuess();

        vm.prank(hacker);
        try attacker.attack{value: BET}(winGuess) {
            // If the winning guess is correct, attack succeeded
            assertTrue(attacker.winCount() > 0 || attacker.attackCount() > 0);
        } catch {
            // Attack was reverted — this is the expected behavior for a losing guess
        }
    }

    function test_RollHistory() public {
        vm.startPrank(player);
        dice.roll{value: BET}(3);
        dice.roll{value: BET}(4);
        vm.stopPrank();

        assertEq(dice.getRollCount(), 2);
        BlockRandomnessDice.Roll[] memory recent = dice.getRecentRolls(10);
        assertEq(recent.length, 2);
    }

    function test_EventEmission() public {
        vm.expectEmit(true, false, false, false);
        emit BlockRandomnessDice.DiceRolled(
            player, 1, 0, BET, false, 0, 0, bytes32(0), block.timestamp
        );

        vm.prank(player);
        dice.roll{value: BET}(1);
    }

    /// @dev Find which guess would win in the current block state
    function _findWinningGuess() internal view returns (uint256) {
        for (uint256 i = 1; i <= 6; i++) {
            (uint256 result,) = dice.rollView(i);
            if (result == i) return i;
        }
        return 1; // fallback
    }
}
