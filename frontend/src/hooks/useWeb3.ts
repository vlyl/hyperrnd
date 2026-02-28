import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

export interface Web3State {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>({
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    balance: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((s) => ({ ...s, error: "No wallet detected. Install MetaMask." }));
      return;
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const balanceBig = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceBig);

      setState({
        provider,
        signer,
        address,
        chainId: Number(network.chainId),
        balance: parseFloat(balance).toFixed(4),
        isConnecting: false,
        error: null,
      });
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed",
      }));
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!state.provider || !state.address) return;
    const balanceBig = await state.provider.getBalance(state.address);
    const balance = parseFloat(ethers.formatEther(balanceBig)).toFixed(4);
    setState((s) => ({ ...s, balance }));
  }, [state.provider, state.address]);

  const switchToLocal = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }], // 31337
      });
    } catch {
      // Chain not added yet, add it
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x7a69",
            chainName: "Local Anvil Fork",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
          },
        ],
      });
    }
  }, []);

  const switchToHyperEVM = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x3e7", // 999
            chainName: "HyperEVM Mainnet",
            rpcUrls: ["https://rpc.hyperliquid.xyz/evm"],
            nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
            blockExplorerUrls: ["https://www.hyperscan.com"],
          },
        ],
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => connect();
    const handleChainChanged = () => connect();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [connect]);

  return { ...state, connect, refreshBalance, switchToLocal, switchToHyperEVM };
}

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
