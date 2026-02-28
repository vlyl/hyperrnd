import { useState } from "react";
import type { Deployments } from "../contracts/addresses";

interface DeploymentGuideProps {
  onConnect: () => void;
  onSwitchToLocal: () => void;
  onSwitchToHyperEVM: () => void;
  isConnecting: boolean;
  address?: string;
  chainId?: number;
  deployments: Deployments | null;
}

function CopyCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 bg-black/50 rounded-lg px-4 py-3 font-mono text-sm group">
      <span className="text-gray-600 select-none">$</span>
      <span className="text-green-300 flex-1">{cmd}</span>
      <button
        onClick={copy}
        className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? "✓ 已复制" : "复制"}
      </button>
    </div>
  );
}

const SETUP_STEPS = [
  {
    id: 1,
    title: "安装依赖",
    icon: "📦",
    desc: "安装 Foundry 合约依赖和前端包",
    cmd: "make install",
    note: "需要 Foundry (forge/anvil) 和 bun 已安装",
  },
  {
    id: 2,
    title: "启动本地 HyperEVM Fork",
    icon: "⛓️",
    desc: "Fork HyperEVM 主网到本地，Chain ID 31337，RPC 端口 8545",
    cmd: "make fork",
    note: "在独立终端窗口运行，演示期间保持运行",
  },
  {
    id: 3,
    title: "部署演示合约",
    icon: "🔨",
    desc: "部署 4 个 Dice 合约 + 3 个 Mock VRF 服务到本地节点",
    cmd: "make deploy",
    note: "合约地址自动写入 frontend/src/contracts/deployments.local.json",
  },
  {
    id: 4,
    title: "导入测试账户到 MetaMask",
    icon: "🔑",
    desc: "将 Anvil 测试私钥导入 MetaMask，账户初始余额 10000 HYPE",
    cmd: "make import-key",
    note: "MetaMask → 账户头像 → 导入账户 → 粘贴私钥",
  },
  {
    id: 5,
    title: "启动前端",
    icon: "🌐",
    desc: "启动 Vite 开发服务器，访问 http://localhost:5173",
    cmd: "make frontend",
    note: "如果前端已在运行可跳过此步",
  },
];

const COMMANDS = [
  { cmd: "make help", desc: "显示所有可用命令" },
  { cmd: "make install", desc: "安装所有依赖（forge + bun）" },
  { cmd: "make fork", desc: "启动 Anvil fork of HyperEVM 主网（Chain 999 → 31337）" },
  { cmd: "make fork-testnet", desc: "启动 Anvil fork of HyperEVM 测试网（Chain 998 → 31337）" },
  { cmd: "make build", desc: "编译所有 Solidity 合约" },
  { cmd: "make test", desc: "运行全部 36 个 Forge 测试" },
  { cmd: "make test-verbose", desc: "运行测试（-vvv 详细输出）" },
  { cmd: "make deploy", desc: "部署所有合约到本地 Anvil fork" },
  { cmd: "make deploy-mainnet", desc: "部署到 HyperEVM 主网（需设置 PRIVATE_KEY）" },
  { cmd: "make frontend", desc: "启动前端开发服务器（localhost:5173）" },
  { cmd: "make frontend-build", desc: "构建前端生产版本" },
  { cmd: "make show-addresses", desc: "显示已部署的合约地址" },
  { cmd: "make block-info", desc: "显示当前区块信息" },
  { cmd: "make check-prevrandao", desc: "检查 block.prevrandao 当前值" },
  { cmd: "make import-key", desc: "显示 Anvil 测试私钥（用于 MetaMask 导入）" },
  { cmd: "make clean", desc: "清理构建产物" },
];

const CONTRACT_ITEMS = [
  { name: "BlockRandomnessDice", key: "blockRandomnessDice", icon: "🔴", tag: "不安全" },
  { name: "CommitRevealDice",    key: "commitRevealDice",    icon: "🟡", tag: "中等" },
  { name: "PythEntropyDice",     key: "pythEntropyDice",     icon: "🟢", tag: "安全" },
  { name: "ProofOfPlayDice",     key: "proofOfPlayDice",     icon: "🟢", tag: "安全" },
  { name: "MockEntropy",         key: "mockEntropy",         icon: "🔧", tag: "Mock" },
  { name: "MockVRNG",            key: "mockVRNG",            icon: "🔧", tag: "Mock" },
];

export function DeploymentGuide({
  onConnect,
  onSwitchToLocal,
  onSwitchToHyperEVM,
  isConnecting,
  address,
  deployments,
}: DeploymentGuideProps) {
  return (
    <div className="space-y-10 max-w-4xl mx-auto">

      {/* Hero */}
      <div className="text-center py-4">
        <div className="text-5xl mb-4">🚀</div>
        <h2 className="text-2xl font-bold mb-2">部署指南</h2>
        <p className="text-gray-400">
          在本地搭建完整演示环境，或将合约部署到 HyperEVM 主网
        </p>
      </div>

      {/* Prerequisites */}
      <section className="bg-casino-card border border-casino-border rounded-2xl p-6">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <span>🛠️</span> 前置条件
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Foundry",
              desc: "Solidity 开发工具链（forge、anvil、cast）",
              install: "curl -L https://foundry.paradigm.xyz | bash",
            },
            {
              name: "Bun",
              desc: "JavaScript 运行时及包管理器",
              install: "curl -fsSL https://bun.sh/install | bash",
            },
            {
              name: "MetaMask",
              desc: "浏览器钱包扩展（或任意 EIP-1193 钱包）",
              install: "从 Chrome/Firefox 扩展商店安装",
            },
          ].map((req) => (
            <div key={req.name} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700">
              <div className="font-bold text-white mb-1">{req.name}</div>
              <div className="text-xs text-gray-400 mb-3">{req.desc}</div>
              <code className="block text-xs text-green-300 bg-black/40 px-2 py-1.5 rounded">
                {req.install}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* Step-by-step */}
      <section>
        <h3 className="text-base font-bold mb-5 flex items-center gap-2">
          <span>📋</span> 快速开始（5 步）
        </h3>
        <div className="space-y-3">
          {SETUP_STEPS.map((step) => (
            <div key={step.id} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-casino-gold text-black font-bold text-sm flex items-center justify-center mt-1">
                {step.id}
              </div>
              <div className="flex-1 bg-casino-card border border-casino-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span>{step.icon}</span>
                  <span className="font-semibold text-white">{step.title}</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">{step.desc}</p>
                <CopyCmd cmd={step.cmd} />
                <p className="text-xs text-gray-500 mt-2">💡 {step.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MetaMask network config */}
      <section className="bg-casino-card border border-casino-border rounded-2xl p-6">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <span>🦊</span> MetaMask 网络配置
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Local */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
            <div className="font-semibold text-blue-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              本地测试网络（推荐）
            </div>
            <dl className="space-y-2.5 text-sm mb-4">
              {[
                ["网络名称", "Anvil Local"],
                ["RPC URL", "http://127.0.0.1:8545"],
                ["Chain ID", "31337"],
                ["货币符号", "HYPE"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-mono text-white text-xs bg-gray-800 px-2 py-0.5 rounded">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-blue-500/20 pt-4 mb-4">
              <div className="text-xs text-gray-400 mb-2">测试账户私钥</div>
              <code className="block text-xs text-yellow-300 bg-black/40 px-3 py-2 rounded break-all leading-5">
                0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
              </code>
              <div className="text-xs text-gray-500 mt-1.5">
                地址: 0xf39F...2266 &nbsp;|&nbsp; 余额: 10,000 HYPE
              </div>
            </div>
            <button
              onClick={onSwitchToLocal}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all"
            >
              自动切换到本地网络
            </button>
          </div>

          {/* HyperEVM Mainnet */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5">
            <div className="font-semibold text-green-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              HyperEVM 主网
            </div>
            <dl className="space-y-2.5 text-sm mb-4">
              {[
                ["网络名称", "HyperEVM"],
                ["RPC URL", "https://rpc.hyperliquid.xyz/evm"],
                ["Chain ID", "999"],
                ["货币符号", "HYPE"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-mono text-white text-xs bg-gray-800 px-2 py-0.5 rounded">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-green-500/20 pt-4 mb-4 space-y-1.5 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <span>⚡</span> 区块速度：1s（快速）/ 1 分钟（慢速）
              </div>
              <div className="flex items-center gap-1.5">
                <span>🏛️</span> ~24 个验证者（HyperBFT 共识）
              </div>
              <div className="flex items-center gap-1.5">
                <span>⚠️</span> block.prevrandao 在此链上不安全
              </div>
            </div>
            <button
              onClick={onSwitchToHyperEVM}
              className="w-full py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all"
            >
              自动切换到 HyperEVM 主网
            </button>
          </div>
        </div>
      </section>

      {/* Deployed addresses */}
      <section className="bg-casino-card border border-casino-border rounded-2xl p-6">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <span>📜</span> 已部署合约地址
        </h3>
        {deployments ? (
          <div className="space-y-2">
            {CONTRACT_ITEMS.map(({ name, key, icon, tag }) => {
              const addr = (deployments as unknown as Record<string, string>)[key];
              if (!addr) return null;
              return (
                <div key={key} className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span>{icon}</span>
                    <span className="text-sm font-medium text-gray-200">{name}</span>
                    <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{tag}</span>
                  </div>
                  <code className="text-xs font-mono text-casino-gold">{addr}</code>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">尚未检测到本地部署</div>
            <div className="max-w-xs mx-auto">
              <CopyCmd cmd="make deploy" />
            </div>
            <div className="text-xs text-gray-600 mt-3">
              运行上方命令后刷新页面即可看到合约地址
            </div>
          </div>
        )}
      </section>

      {/* Commands reference */}
      <section className="bg-casino-card border border-casino-border rounded-2xl p-6">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2">
          <span>⌨️</span> Makefile 命令参考
        </h3>
        <div className="divide-y divide-gray-800">
          {COMMANDS.map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-center gap-4 py-2.5">
              <code className="text-green-300 text-sm font-mono w-56 flex-shrink-0">{cmd}</code>
              <span className="text-gray-400 text-sm">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Connect CTA */}
      {!address && (
        <div className="bg-casino-gold/10 border border-casino-gold/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-bold text-casino-gold mb-2">准备就绪？</h3>
          <p className="text-gray-400 text-sm mb-5">完成上方配置后，连接钱包即可开始演示</p>
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="px-8 py-3 bg-casino-gold text-black font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-all"
          >
            {isConnecting ? "连接中..." : "连接 MetaMask"}
          </button>
        </div>
      )}
    </div>
  );
}
