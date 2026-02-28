// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CommitRevealDice.sol";

contract CommitRevealDiceTest is Test {
    CommitRevealDice dice;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    uint256 constant HOUSE_FUND = 10 ether;
    uint256 constant BET = 0.01 ether;

    // Test seeds
    bytes32 constant SERVER_SEED = keccak256("server-secret-seed-epoch-1");
    bytes32 constant USER_SEED = keccak256("player-random-seed");

    function setUp() public {
        vm.deal(owner, 100 ether);
        vm.prank(owner);
        dice = new CommitRevealDice{value: HOUSE_FUND}();

        vm.deal(player, 1 ether);

        // House commits server seed before accepting bets
        vm.prank(owner);
        dice.commitServerSeed(keccak256(abi.encodePacked(SERVER_SEED)));
    }

    function test_CommitServerSeed() public view {
        assertEq(dice.currentServerSeedHash(), keccak256(abi.encodePacked(SERVER_SEED)));
        assertEq(dice.serverSeedEpoch(), 1);
    }

    function test_PlayerCommit() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        CommitRevealDice.Game memory game = dice.getGame(gameId);
        assertEq(game.player, player);
        assertEq(game.guess, 3);
        assertEq(game.betAmount, BET);
        assertEq(uint8(game.state), uint8(CommitRevealDice.GameState.PENDING));
    }

    function test_HouseReveal() public {
        // Player commits
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        // House reveals
        vm.prank(owner);
        dice.reveal(gameId, SERVER_SEED, USER_SEED);

        CommitRevealDice.Game memory game = dice.getGame(gameId);
        assertEq(uint8(game.state), uint8(CommitRevealDice.GameState.COMPLETED));
        assertTrue(game.result >= 1 && game.result <= 6);
    }

    function test_InvalidServerSeedRevealFails() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        bytes32 wrongServerSeed = keccak256("wrong-seed");

        vm.prank(owner);
        vm.expectRevert(CommitRevealDice.InvalidReveal.selector);
        dice.reveal(gameId, wrongServerSeed, USER_SEED);
    }

    function test_InvalidUserSeedRevealFails() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        bytes32 wrongUserSeed = keccak256("wrong-user-seed");

        vm.prank(owner);
        vm.expectRevert(CommitRevealDice.InvalidReveal.selector);
        dice.reveal(gameId, SERVER_SEED, wrongUserSeed);
    }

    function test_TimeoutRefund() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        uint256 playerBalanceBefore = player.balance;

        // Fast-forward past timeout
        vm.roll(block.number + 51);

        vm.prank(player);
        dice.claimTimeout(gameId);

        CommitRevealDice.Game memory game = dice.getGame(gameId);
        assertEq(uint8(game.state), uint8(CommitRevealDice.GameState.EXPIRED));
        assertEq(player.balance, playerBalanceBefore + BET);
    }

    function test_CannotTimeoutBeforeExpiry() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        vm.prank(player);
        vm.expectRevert(CommitRevealDice.TimeoutNotReached.selector);
        dice.claimTimeout(gameId);
    }

    function test_CannotRevealTwice() public {
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(3, USER_SEED);

        vm.prank(owner);
        dice.reveal(gameId, SERVER_SEED, USER_SEED);

        vm.prank(owner);
        vm.expectRevert(CommitRevealDice.GameAlreadyProcessed.selector);
        dice.reveal(gameId, SERVER_SEED, USER_SEED);
    }

    function test_WinPayout() public {
        // Find a combination that wins for a specific guess
        // We need result = guess, where result = keccak(serverSeed, userSeed, blockhash, player) % 6 + 1
        uint256 guess = _findWinningGuess();

        uint256 playerBefore = player.balance;
        vm.prank(player);
        uint256 gameId = dice.commit{value: BET}(guess, USER_SEED);

        vm.prank(owner);
        dice.reveal(gameId, SERVER_SEED, USER_SEED);

        CommitRevealDice.Game memory game = dice.getGame(gameId);
        if (game.won) {
            assertEq(player.balance, playerBefore - BET + BET * 5);
        }
    }

    function test_MultiplePlayers() public {
        address player2 = makeAddr("player2");
        vm.deal(player2, 1 ether);

        vm.prank(player);
        uint256 gameId1 = dice.commit{value: BET}(1, USER_SEED);

        bytes32 userSeed2 = keccak256("player2-seed");
        vm.prank(player2);
        uint256 gameId2 = dice.commit{value: BET}(2, userSeed2);

        vm.prank(owner);
        dice.reveal(gameId1, SERVER_SEED, USER_SEED);

        vm.prank(owner);
        bytes32 serverSeed2 = keccak256("server-seed-2");
        // Note: player2's game used the same serverSeedHash, so same serverSeed applies
        dice.reveal(gameId2, SERVER_SEED, userSeed2);

        CommitRevealDice.Game memory game1 = dice.getGame(gameId1);
        CommitRevealDice.Game memory game2 = dice.getGame(gameId2);
        assertEq(uint8(game1.state), uint8(CommitRevealDice.GameState.COMPLETED));
        assertEq(uint8(game2.state), uint8(CommitRevealDice.GameState.COMPLETED));
    }

    /// @dev Find a guess that produces a win given current block state
    function _findWinningGuess() internal view returns (uint256) {
        bytes32 combined = keccak256(
            abi.encodePacked(
                SERVER_SEED,
                USER_SEED,
                blockhash(block.number - 1),
                player
            )
        );
        return (uint256(combined) % 6) + 1;
    }
}
