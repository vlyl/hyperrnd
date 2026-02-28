// Contract deployment addresses per network
// Update deployments.local.json after running: make deploy

export interface Deployments {
  blockRandomnessDice: string;
  commitRevealDice: string;
  pythEntropyDice: string;
  proofOfPlayDice: string;
  mockEntropy?: string;
  mockVRNG?: string;
  serverSeedHash?: string;
  note?: string;
}

export const NETWORKS: Record<number, { name: string; rpc: string; explorer: string; isLocal: boolean }> = {
  31337: {
    name: "Local Fork (Anvil)",
    rpc: "http://127.0.0.1:8545",
    explorer: "",
    isLocal: true,
  },
  999: {
    name: "HyperEVM Mainnet",
    rpc: "https://rpc.hyperliquid.xyz/evm",
    explorer: "https://www.hyperscan.com",
    isLocal: false,
  },
  998: {
    name: "HyperEVM Testnet",
    rpc: "https://rpc.hyperliquid-testnet.xyz/evm",
    explorer: "",
    isLocal: false,
  },
};
