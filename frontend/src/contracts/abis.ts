// Auto-generated ABIs from Foundry build artifacts

export const BLOCK_RANDOMNESS_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "fundHouse",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "roll",
    "inputs": [{"name": "guess", "type": "uint256"}],
    "outputs": [
      {"name": "result", "type": "uint256"},
      {"name": "won", "type": "bool"}
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "rollView",
    "inputs": [{"name": "guess", "type": "uint256"}],
    "outputs": [
      {"name": "result", "type": "uint256"},
      {"name": "wouldWin", "type": "bool"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "houseBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRollCount",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecentRolls",
    "inputs": [{"name": "count", "type": "uint256"}],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {"name": "player", "type": "address"},
          {"name": "guess", "type": "uint256"},
          {"name": "result", "type": "uint256"},
          {"name": "betAmount", "type": "uint256"},
          {"name": "won", "type": "bool"},
          {"name": "blockNumber", "type": "uint256"},
          {"name": "timestamp", "type": "uint256"},
          {"name": "prevrandao", "type": "bytes32"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "DiceRolled",
    "inputs": [
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "result", "type": "uint256", "indexed": false},
      {"name": "betAmount", "type": "uint256", "indexed": false},
      {"name": "won", "type": "bool", "indexed": false},
      {"name": "payout", "type": "uint256", "indexed": false},
      {"name": "rollId", "type": "uint256", "indexed": true},
      {"name": "prevrandao", "type": "bytes32", "indexed": false},
      {"name": "timestamp", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  { "type": "error", "name": "InsufficientBet",      "inputs": [{"name": "provided", "type": "uint256"}, {"name": "minimum",  "type": "uint256"}] },
  { "type": "error", "name": "ExcessiveBet",         "inputs": [{"name": "provided", "type": "uint256"}, {"name": "maximum",  "type": "uint256"}] },
  { "type": "error", "name": "InvalidGuess",         "inputs": [{"name": "guess",    "type": "uint256"}, {"name": "sides",    "type": "uint256"}] },
  { "type": "error", "name": "InsufficientHouseFunds","inputs": [{"name": "required", "type": "uint256"}, {"name": "available","type": "uint256"}] },
  { "type": "error", "name": "OnlyOwner",            "inputs": [] },
  { "type": "error", "name": "TransferFailed",       "inputs": [] }
] as const;

export const COMMIT_REVEAL_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "fundHouse",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "commitServerSeed",
    "inputs": [{"name": "serverSeedHash", "type": "bytes32"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "commit",
    "inputs": [
      {"name": "guess", "type": "uint256"},
      {"name": "userSeed", "type": "bytes32"}
    ],
    "outputs": [{"name": "gameId", "type": "uint256"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "reveal",
    "inputs": [
      {"name": "gameId", "type": "uint256"},
      {"name": "serverSeed", "type": "bytes32"},
      {"name": "userSeed", "type": "bytes32"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimTimeout",
    "inputs": [{"name": "gameId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "currentServerSeedHash",
    "inputs": [],
    "outputs": [{"name": "", "type": "bytes32"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "houseBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameCount",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "games",
    "inputs": [{"name": "gameId", "type": "uint256"}],
    "outputs": [
      {"name": "player", "type": "address"},
      {"name": "guess", "type": "uint256"},
      {"name": "playerCommit", "type": "bytes32"},
      {"name": "serverSeedHash", "type": "bytes32"},
      {"name": "betAmount", "type": "uint256"},
      {"name": "commitBlock", "type": "uint256"},
      {"name": "state", "type": "uint8"},
      {"name": "result", "type": "uint256"},
      {"name": "won", "type": "bool"}
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "GameCommitted",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "playerCommit", "type": "bytes32", "indexed": false},
      {"name": "serverSeedHash", "type": "bytes32", "indexed": false},
      {"name": "betAmount", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "GameRevealed",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "result", "type": "uint256", "indexed": false},
      {"name": "won", "type": "bool", "indexed": false},
      {"name": "payout", "type": "uint256", "indexed": false},
      {"name": "serverSeed", "type": "bytes32", "indexed": false},
      {"name": "userSeed", "type": "bytes32", "indexed": false}
    ]
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  }
] as const;

export const PYTH_ENTROPY_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {"name": "_entropy", "type": "address"},
      {"name": "_provider", "type": "address"}
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "fundHouse",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "requestRoll",
    "inputs": [
      {"name": "guess", "type": "uint256"},
      {"name": "userSeed", "type": "bytes32"}
    ],
    "outputs": [{"name": "gameId", "type": "uint256"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getRequestFee",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint128"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "houseBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameCount",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGame",
    "inputs": [{"name": "gameId", "type": "uint256"}],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {"name": "player", "type": "address"},
          {"name": "guess", "type": "uint256"},
          {"name": "betAmount", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "result", "type": "uint256"},
          {"name": "won", "type": "bool"},
          {"name": "randomNumber", "type": "bytes32"},
          {"name": "requestBlock", "type": "uint256"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "GameRequested",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "sequenceNumber", "type": "uint64", "indexed": true},
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "betAmount", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "GameResolved",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "result", "type": "uint256", "indexed": false},
      {"name": "won", "type": "bool", "indexed": false},
      {"name": "payout", "type": "uint256", "indexed": false},
      {"name": "randomNumber", "type": "bytes32", "indexed": false}
    ]
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  }
] as const;

export const PROOF_OF_PLAY_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {"name": "_vrng", "type": "address"},
      {"name": "_vrngCallbackSender", "type": "address"}
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "fundHouse",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "requestRoll",
    "inputs": [{"name": "guess", "type": "uint256"}],
    "outputs": [{"name": "gameId", "type": "uint256"}],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "houseBalance",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "gameCount",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGame",
    "inputs": [{"name": "gameId", "type": "uint256"}],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {"name": "player", "type": "address"},
          {"name": "guess", "type": "uint256"},
          {"name": "betAmount", "type": "uint256"},
          {"name": "state", "type": "uint8"},
          {"name": "result", "type": "uint256"},
          {"name": "won", "type": "bool"},
          {"name": "randomNumber", "type": "uint256"},
          {"name": "traceId", "type": "uint256"},
          {"name": "requestBlock", "type": "uint256"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "GameRequested",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "requestId", "type": "uint256", "indexed": true},
      {"name": "traceId", "type": "uint256", "indexed": true},
      {"name": "player", "type": "address", "indexed": false},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "betAmount", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "GameResolved",
    "inputs": [
      {"name": "gameId", "type": "uint256", "indexed": true},
      {"name": "player", "type": "address", "indexed": true},
      {"name": "guess", "type": "uint256", "indexed": false},
      {"name": "result", "type": "uint256", "indexed": false},
      {"name": "won", "type": "bool", "indexed": false},
      {"name": "payout", "type": "uint256", "indexed": false},
      {"name": "randomNumber", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  }
] as const;

export const MOCK_VRNG_ABI = [
  {
    "type": "function",
    "name": "fulfillRequest",
    "inputs": [{"name": "requestId", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fulfillAll",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestCounter",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  }
] as const;
