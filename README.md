# HyperEVM RNG Lab

在 HyperEVM 上开发 Casino 应用时的随机数方案研究与演示。

## 项目结构

```
hyperrnd/
├── contracts/              # Foundry 合约项目
│   ├── src/
│   │   ├── interfaces/     # VRF 接口定义
│   │   │   ├── IEntropy.sol          (Pyth Entropy)
│   │   │   └── IProofOfPlayVRNG.sol  (Proof of Play)
│   │   ├── mocks/          # 本地测试 Mock 合约
│   │   │   ├── MockEntropy.sol
│   │   │   └── MockProofOfPlayVRNG.sol
│   │   ├── BlockRandomnessDice.sol   # ⚠️ 不安全（演示用）
│   │   ├── CommitRevealDice.sol      # 🟡 中等安全
│   │   ├── PythEntropyDice.sol       # 🟢 生产级安全
│   │   └── ProofOfPlayDice.sol       # 🟢 生产级安全
│   ├── test/               # Forge 测试（36个测试）
│   └── script/
│       └── Deploy.s.sol    # 部署脚本（本地/主网）
├── frontend/               # React + Vite + TypeScript
│   └── src/
│       ├── components/     # 各方案演示组件
│       ├── contracts/      # ABI 和地址配置
│       └── hooks/          # Web3 钩子
└── Makefile               # 一键命令
```

## 快速开始

### 1. 安装依赖

```bash
make install
```

### 2. 启动本地 HyperEVM Fork

```bash
# 窗口 1：Fork HyperEVM 主网到本地
make fork
```

这会启动 Anvil 并 Fork HyperEVM 主网（RPC: http://127.0.0.1:8545）。

### 3. 部署合约

```bash
# 窗口 2：部署所有演示合约
make deploy
```

自动部署 4 个合约（3 个 Mock 服务），地址写入 `frontend/src/contracts/deployments.local.json`。

### 4. 启动前端

```bash
# 窗口 2（或 3）：
make frontend
# 访问 http://localhost:5173
```

### 5. 配置 MetaMask

```bash
# 显示测试私钥
make import-key
```

1. 在 MetaMask 导入 Anvil 测试账户私钥
2. 添加本地网络：`http://127.0.0.1:8545`，Chain ID: `31337`
3. 连接钱包，开始演示

## 四种随机数方案

### 🔴 Block Variables（区块变量） — 不安全

**合约**: `BlockRandomnessDice.sol`

```solidity
// ⚠️ 危险！勿在生产使用
result = keccak256(block.prevrandao, block.timestamp, block.number, msg.sender) % 6 + 1
```

**攻击方式**:
- HyperEVM 只有 ~24 个验证者，任何验证者可以不出块来重新抽取 `prevrandao`
- 攻击者合约可以在同一交易中预览结果，不利时 `revert`（无成本重试）
- 前端有攻击模拟器演示此漏洞

### 🟡 Commit-Reveal（承诺揭示） — 中等安全

**合约**: `CommitRevealDice.sol`

两阶段协议：
1. **承诺阶段**: 玩家提交 `hash(userSeed)` + 猜测 + 押注
2. **揭示阶段**: 庄家揭示 `serverSeed`，结合双方种子计算结果

```
result = hash(serverSeed XOR userSeed XOR blockhash)
```

**安全保障**: 超时机制（50块内不揭示，玩家可取回押注）

### 🟢 Pyth Entropy — 生产级安全

**合约**: `PythEntropyDice.sol`
**HyperEVM 地址**: 查询 [entropy-explorer.pyth.network](https://entropy-explorer.pyth.network/) (Chain 999)

```solidity
// 1. 请求随机数
seqNum = entropy.requestWithCallback{value: fee}(provider, userSeed)

// 2. Pyth 异步回调
function entropyCallback(seqNum, provider, randomNumber) {
    result = (uint256(randomNumber) % 6) + 1;
}
```

LiquidFlip（HyperEVM 上的赌博 dApp）使用此方案。

### 🟢 Proof of Play vRNG — 生产级安全

**合约**: `ProofOfPlayDice.sol`
**HyperEVM 地址**: `0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1`

基于 [drand](https://drand.love/)（League of Entropy）分布式随机数信标：
- 16+ 个独立机构（Protocol Labs、Cloudflare、EPFL 等）
- 阈值 BLS 签名，需要 1/3+ 机构合谋才能操控
- 公开可验证

```bash
# 需要向 Proof of Play 申请白名单
# https://docs.proofofplay.com/services/vrng/about
```

## 运行测试

```bash
make test
# 36 个测试，4 个合约，全部通过
```

测试覆盖：
- 基础功能测试
- 安全边界测试（无效猜测、余额不足）
- 攻击场景演示（BlockRandomness）
- 超时机制测试（CommitReveal）
- VRF 回调测试（Pyth / PoP）

## HyperEVM 网络信息

| 参数 | 主网 | 测试网 |
|------|------|--------|
| Chain ID | 999 | 998 |
| RPC | `https://rpc.hyperliquid.xyz/evm` | `https://rpc.hyperliquid-testnet.xyz/evm` |
| 区块速度 | 1s (fast) / 1min (slow) | 同上 |
| 验证者数量 | ~24 | - |
| Gas Token | HYPE | HYPE |

## 安全结论

| 方案 | 生产可用 | 延迟 | 成本 |
|------|---------|------|------|
| Block Variables | ❌ 绝对不可用 | 即时 | 0 |
| Commit-Reveal | ⚠️ 有条件可用 | 2 笔 tx | 2x gas |
| Pyth Entropy | ✅ 推荐 | ~1-3s | entropy fee |
| Proof of Play vRNG | ✅ 推荐 | ~1-3s | 免费（需注册） |

**核心原则**: 在 HyperEVM 上开发任何有价值的随机性应用，必须使用 Pyth Entropy 或 Proof of Play vRNG。`block.prevrandao` 在 HyperEVM 上不安全，因为验证者数量极少（~24），操控成本极低。
