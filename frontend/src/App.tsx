import { useState, useEffect } from "react";
import { useWeb3 } from "./hooks/useWeb3";
import { SecurityMatrix } from "./components/SecurityMatrix";
import { BlockRandomnessDemo } from "./components/BlockRandomnessDemo";
import { CommitRevealDemo } from "./components/CommitRevealDemo";
import { PythEntropyDemo } from "./components/PythEntropyDemo";
import { ProofOfPlayDemo } from "./components/ProofOfPlayDemo";
import { TechnicalAnalysis } from "./components/TechnicalAnalysis";
import { DeploymentGuide } from "./components/DeploymentGuide";
import { RNG_METHODS } from "./types";
import { NETWORKS } from "./contracts/addresses";
import type { Deployments } from "./contracts/addresses";

async function loadDeployments(chainId: number): Promise<Deployments | null> {
  if (chainId === 31337) {
    try {
      const res = await fetch(`/deployments.local.json?t=${Date.now()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

type MainSection = "demo" | "deploy" | "docs";
type DemoTab = "block" | "commit" | "pyth" | "pop";
type DocsTab = "overview" | "tech";

const MAIN_SECTIONS: { id: MainSection; label: string; icon: string }[] = [
  { id: "demo",   label: "演示 Demo", icon: "🎮" },
  { id: "deploy", label: "部署指南",  icon: "🚀" },
  { id: "docs",   label: "技术文档",  icon: "📚" },
];

const DEMO_TABS: { id: DemoTab; label: string; icon: string }[] = [
  { id: "block",  label: "区块变量",  icon: "🔴" },
  { id: "commit", label: "承诺揭示",  icon: "🟡" },
  { id: "pyth",   label: "Pyth VRF",  icon: "🟢" },
  { id: "pop",    label: "PoP drand", icon: "🟢" },
];

const DOCS_TABS: { id: DocsTab; label: string; icon: string }[] = [
  { id: "overview", label: "安全对比",   icon: "📊" },
  { id: "tech",     label: "技术安全论证", icon: "📐" },
];

export default function App() {
  const web3 = useWeb3();
  const [section, setSection]     = useState<MainSection>("demo");
  const [demoTab, setDemoTab]     = useState<DemoTab>("block");
  const [docsTab, setDocsTab]     = useState<DocsTab>("overview");
  const [deployments, setDeployments] = useState<Deployments | null>(null);

  useEffect(() => {
    if (web3.chainId) {
      loadDeployments(web3.chainId).then(setDeployments);
    }
  }, [web3.chainId]);

  const network = web3.chainId ? NETWORKS[web3.chainId] : null;
  const isLocalNetwork = network?.isLocal ?? false;
  const isUnsupportedNetwork = !!web3.address && !!web3.chainId && !NETWORKS[web3.chainId];

  // Navigate to a demo tab (also switches to demo section)
  const goToDemo = (tab: DemoTab) => {
    setSection("demo");
    setDemoTab(tab);
  };

  return (
    <div className="min-h-screen bg-casino-dark text-white">
      {/* ── Sticky Header ── */}
      <header className="border-b border-casino-border bg-casino-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-2xl">🎲</span>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-white leading-tight">HyperEVM RNG Lab</h1>
              <p className="text-xs text-gray-500">链上随机数安全研究</p>
            </div>
          </div>

          {/* Main navigation — center */}
          <nav className="flex-1 flex justify-center">
            <div className="flex bg-gray-800/70 rounded-xl p-1 gap-0.5">
              {MAIN_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                    section === s.id
                      ? "bg-gray-700 text-white shadow"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Wallet area — right */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {web3.chainId && (
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${
                isLocalNetwork
                  ? "bg-blue-900/30 border-blue-500/50 text-blue-300"
                  : web3.chainId === 999
                  ? "bg-green-900/30 border-green-500/50 text-green-300"
                  : "bg-gray-800 border-gray-600 text-gray-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isLocalNetwork ? "bg-blue-400" : web3.chainId === 999 ? "bg-green-400" : "bg-gray-400"
                }`} />
                {network?.name ?? `Chain ${web3.chainId}`}
              </div>
            )}
            {web3.balance && (
              <div className="hidden sm:block text-sm">
                <span className="text-casino-gold font-mono">{web3.balance}</span>
                <span className="text-xs text-gray-500 ml-1">HYPE</span>
              </div>
            )}
            {web3.address ? (
              <span className="text-xs text-gray-400 font-mono bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                {web3.address.slice(0, 6)}…{web3.address.slice(-4)}
              </span>
            ) : (
              <button
                onClick={web3.connect}
                disabled={web3.isConnecting}
                className="px-4 py-1.5 bg-casino-gold text-black font-bold rounded-lg text-sm hover:bg-yellow-400 disabled:opacity-50 transition-all"
              >
                {web3.isConnecting ? "连接中…" : "连接钱包"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Wrong-network banner */}
      {isUnsupportedNetwork && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-yellow-300 text-sm">请切换到本地测试网络或 HyperEVM</span>
            <div className="flex gap-2">
              <button
                onClick={web3.switchToLocal}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all"
              >
                本地 Anvil
              </button>
              <button
                onClick={web3.switchToHyperEVM}
                className="px-3 py-1 text-xs bg-green-700 hover:bg-green-600 rounded-lg text-white transition-all"
              >
                HyperEVM 主网
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Content ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* ─── DEMO SECTION ─── */}
        {section === "demo" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">随机数方案演示</h2>
              <p className="text-gray-400 text-sm">
                选择一种随机数方案，连接钱包后进行实际掷骰子演示
              </p>
            </div>

            {/* Method selector cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {RNG_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => goToDemo(m.id as DemoTab)}
                  className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.03] ${
                    demoTab === m.id
                      ? m.securityLevel === "insecure"
                        ? "bg-red-900/40 border-red-500 ring-1 ring-red-500/30"
                        : m.securityLevel === "medium"
                        ? "bg-yellow-900/40 border-yellow-500 ring-1 ring-yellow-500/30"
                        : "bg-green-900/40 border-green-500 ring-1 ring-green-500/30"
                      : "bg-casino-card border-casino-border hover:border-gray-500"
                  }`}
                >
                  <div className="text-2xl mb-2">{m.icon}</div>
                  <div className="font-semibold text-sm">{m.shortName}</div>
                  <div className="text-xs text-gray-400 mt-1">{m.latency}</div>
                  <div className="mt-2 flex gap-0.5">
                    {[...Array(10)].map((_, i) => (
                      <span
                        key={i}
                        className={`inline-block w-2 h-2 rounded-full ${
                          i < m.securityScore
                            ? m.securityLevel === "insecure" ? "bg-red-500"
                              : m.securityLevel === "medium" ? "bg-yellow-500"
                              : "bg-green-500"
                            : "bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>

            {/* Demo sub-tabs */}
            <div className="flex gap-0 mb-6 border-b border-casino-border">
              {DEMO_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDemoTab(tab.id)}
                  className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
                    demoTab === tab.id
                      ? "border-casino-gold text-casino-gold"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Demo content */}
            {demoTab === "block" && (
              <BlockRandomnessDemo
                contractAddress={deployments?.blockRandomnessDice ?? "0x0000000000000000000000000000000000000000"}
                signer={web3.signer}
                onRefreshBalance={web3.refreshBalance}
              />
            )}
            {demoTab === "commit" && (
              <CommitRevealDemo
                contractAddress={deployments?.commitRevealDice ?? "0x0000000000000000000000000000000000000000"}
                signer={web3.signer}
                onRefreshBalance={web3.refreshBalance}
              />
            )}
            {demoTab === "pyth" && (
              <PythEntropyDemo
                contractAddress={deployments?.pythEntropyDice ?? "0x0000000000000000000000000000000000000000"}
                signer={web3.signer}
                provider={web3.provider}
                onRefreshBalance={web3.refreshBalance}
              />
            )}
            {demoTab === "pop" && (
              <ProofOfPlayDemo
                contractAddress={deployments?.proofOfPlayDice ?? "0x0000000000000000000000000000000000000000"}
                mockVRNGAddress={deployments?.mockVRNG}
                signer={web3.signer}
                provider={web3.provider}
                onRefreshBalance={web3.refreshBalance}
              />
            )}
          </div>
        )}

        {/* ─── DEPLOY SECTION ─── */}
        {section === "deploy" && (
          <DeploymentGuide
            onConnect={web3.connect}
            onSwitchToLocal={web3.switchToLocal}
            onSwitchToHyperEVM={web3.switchToHyperEVM}
            isConnecting={web3.isConnecting}
            address={web3.address ?? undefined}
            chainId={web3.chainId ?? undefined}
            deployments={deployments}
          />
        )}

        {/* ─── DOCS SECTION ─── */}
        {section === "docs" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">技术文档</h2>
              <p className="text-gray-400 text-sm">
                各方案安全性量化对比，以及 VRF 密码学原理深度解析
              </p>
            </div>

            {/* Docs sub-tabs */}
            <div className="flex gap-0 mb-6 border-b border-casino-border">
              {DOCS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDocsTab(tab.id)}
                  className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
                    docsTab === tab.id
                      ? "border-purple-400 text-purple-400"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {docsTab === "overview" && <SecurityMatrix />}
            {docsTab === "tech" && <TechnicalAnalysis />}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-casino-border text-center text-xs text-gray-600">
          <div className="mb-2">HyperEVM RNG Demo · Powered by Foundry + React + Vite</div>
          <div className="space-x-4">
            <a
              href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm"
              className="hover:text-gray-400 transition-colors"
              target="_blank" rel="noopener noreferrer"
            >
              HyperEVM Docs
            </a>
            <a
              href="https://docs.pyth.network/entropy"
              className="hover:text-gray-400 transition-colors"
              target="_blank" rel="noopener noreferrer"
            >
              Pyth Entropy
            </a>
            <a
              href="https://docs.proofofplay.com/services/vrng/about"
              className="hover:text-gray-400 transition-colors"
              target="_blank" rel="noopener noreferrer"
            >
              Proof of Play vRNG
            </a>
            <a
              href="https://drand.love"
              className="hover:text-gray-400 transition-colors"
              target="_blank" rel="noopener noreferrer"
            >
              drand
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
