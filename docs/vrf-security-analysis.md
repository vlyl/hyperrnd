# HyperEVM 可验证随机数 — 技术安全论证

> 版本 1.0 | 适用于 HyperEVM Casino/Gaming 应用开发

---

## 目录

1. [HyperEVM 随机数的特殊安全考量](#1-hyperevm-随机数的特殊安全考量)
2. [Pyth Entropy — 技术分析](#2-pyth-entropy--技术分析)
   - 2.1 密码学基础
   - 2.2 协议流程
   - 2.3 安全属性证明
   - 2.4 威胁模型分析
   - 2.5 使用指南
3. [Proof of Play vRNG — 技术分析](#3-proof-of-play-vrng--技术分析)
   - 3.1 drand 协议原理
   - 3.2 阈值 BLS 签名数学基础
   - 3.3 League of Entropy 组成
   - 3.4 安全属性证明
   - 3.5 威胁模型分析
   - 3.6 使用指南
4. [方案对比与选择建议](#4-方案对比与选择建议)
5. [集成安全检查清单](#5-集成安全检查清单)

---

## 1. HyperEVM 随机数的特殊安全考量

### 1.1 为何 HyperEVM 比以太坊主网更危险

以太坊在 The Merge 后通过 EIP-4399 将 `DIFFICULTY` 操作码替换为 `PREVRANDAO`，其值来源于 Beacon Chain 的 RANDAO 累加器。这个方案的安全性依赖于：

- **大量验证者**：以太坊主网有 500,000+ 活跃验证者
- **BLS 多签聚合**：每个 epoch 的 RANDAO 值是数百个验证者 BLS 签名的 XOR 聚合
- **高攻击成本**：操控一个 epoch 的 RANDAO 需要控制最后一个提议者，代价是损失约 16 ETH 的 MEV + 惩罚

**HyperEVM 的实际情况截然不同：**

| 参数 | Ethereum Mainnet | HyperEVM |
|------|-----------------|----------|
| 验证者数量 | ~500,000 | ~24（截至 2026-02） |
| 共识机制 | Ethereum PoS | HyperBFT (HotStuff) |
| prevrandao 来源 | Beacon RANDAO (BLS aggregate) | 未文档化（非 RANDAO） |
| 单验证者出块概率 | ~0.0002% | ~4.2% |
| 操控 prevrandao 成本 | 损失约 16+ ETH + 惩罚 | 损失 1 次出块奖励 |
| 出块时间 | 12 秒 | 1 秒（fast blocks） |

### 1.2 具体攻击向量

**攻击 1：验证者选择性不出块（Block Withholding）**
```
攻击者（验证者）流程：
1. 准备出块时，计算当前 prevrandao 对应的游戏结果
2. 如果结果不利（例如 Casino 会赢），选择放弃此次出块
3. 等待下一个有利的 prevrandao 值
4. 提交对赌注最有利的区块

成本：仅损失一次出块奖励（约占总收入 4.8%）
收益：从 Casino 中获取的利润可能远大于一次出块奖励
```

**攻击 2：Revert-if-Unfavorable（重入回退攻击）**
```solidity
// 攻击者合约（部署在同一区块）
contract Attacker {
    function attack(uint256 guess) external payable {
        // 在同一区块内预览结果（使用相同的 block.prevrandao）
        (uint256 result, bool wouldWin) = casino.rollView(guess);

        if (!wouldWin) {
            // 不会损失任何资金，只损失 gas
            revert("Unfavorable - retry next block");
        }

        // 只有在确定赢的情况下才提交
        casino.roll{value: msg.value}(guess);
    }
}
```

**攻击 3：front-running（前运行）**
- 块提议者可以看到 mempool 中的待定交易
- 在用户交易被打包前，提议者已知道该区块的所有随机数
- 可以选择性地包含/排除交易来操控结果

### 1.3 结论

**在 HyperEVM 上，任何依赖区块变量（`block.prevrandao`、`block.timestamp`、`blockhash`）的随机数方案都不适合用于有资金风险的应用。** 必须使用外部可验证随机函数（VRF）。

---

## 2. Pyth Entropy — 技术分析

### 2.1 密码学基础

Pyth Entropy 实现了**双方承诺-揭示协议（Dual Commit-Reveal Protocol）**。按官方协议设计，Provider 种子通过链上哈希承诺可审计，随机性可验证；但并非每次请求均在链上提交完整 ECVRF 证明。

#### 核心密码学原语

**哈希函数 SHA-256**：
- 抗碰撞性（Collision Resistance）：找到 x ≠ y 使 H(x) = H(y) 计算不可行
- 单向性（Preimage Resistance）：给定 H(x)，找到 x 计算不可行
- 用途：承诺方案的绑定性保证

**可验证随机函数（VRF）原理参考**（Pyth 采用双承诺可审计协议，而非 per-request 链上 ECVRF 证明）：

VRF 满足三个关键属性：
1. **正确性（Correctness）**：合法生成的证明总能通过验证
2. **唯一性（Uniqueness）**：对于给定的私钥和输入，输出唯一
3. **伪随机性（Pseudorandomness）**：不知道私钥的情况下，输出看起来随机

VRF 的数学构造（基于 Schnorr/DLEQ）：
```
给定：椭圆曲线 E，基点 G，私钥 sk，公钥 pk = sk·G

VRF_prove(sk, alpha):
  H = encode_to_curve(alpha)  // 将输入映射到曲线点
  gamma = sk · H              // VRF hash
  k = random_nonce()
  c = challenge(pk, H, gamma, k·G, k·H)  // Fiat-Shamir
  s = k - c·sk (mod q)
  proof π = (gamma, c, s)
  beta = hash(gamma)          // VRF output

VRF_verify(pk, alpha, beta, π):
  U = s·G + c·pk
  V = s·H + c·gamma
  c' = challenge(pk, H, gamma, U, V)
  return c == c' and beta == hash(gamma)
```

### 2.2 协议流程

```
Provider (off-chain)         智能合约                    User (dApp)
       │                        │                           │
       │  (1) 生成 providerSeed  │                           │
       │  providerSeedHash =    │                           │
       │    SHA256(providerSeed) │                           │
       │                        │                           │
       │──commitProvider()─────→│ 存储 providerSeedHash      │
       │                        │                           │
       │                        │←──requestWithCallback()───│
       │                        │   (userSeed, fee)         │
       │                        │                           │
       │                        │──emit Request(seqNum)──→  │
       │                        │                           │
       │←──notify(seqNum,uS)───│                           │
       │                        │                           │
       │  (2) 计算 VRF 输出      │                           │
       │  randomNum =            │                           │
       │    VRF(providerSeed,   │                           │
       │         userSeed)       │                           │
       │                        │                           │
       │──entropyCallback()────→│ 验证 VRF 证明              │
       │  (seqNum, randomNum, π) │ 调用消费者合约             │
       │                        │──entropyCallback()──────→ │
       │                        │  (seqNum, provider, rNum) │
```

**关键安全点**：
- Provider 的种子在 **任何用户请求之前** 已承诺，无法针对特定用户调整
- 用户的种子对 Provider 不可见（只发送哈希），Provider 无法预测 XOR 结果
- VRF 证明可以链上验证，确保 Provider 使用了承诺的种子

### 2.3 安全属性证明

#### 属性 1：不可预测性（Unpredictability）

**定理**：假设 H 是随机预言机（ROM 假设），ECDLP 在所用曲线上是困难的。在至少一方诚实的情况下，`randomNumber` 对于外部观察者是计算不可行预测的。

**证明框架（以 Provider 恶意为例）**：
```
假设：Provider 试图预测最终随机数以获利

情况 A：Provider 恶意，User 诚实
- User 生成真随机的 userSeed ← $U{0,1}^{256}
- Provider 已提交 providerSeedHash 之前不知道 userSeed
- randomNumber = H(providerSeed ⊕ userSeed)
- 即使 Provider 选择了特定的 providerSeed，userSeed 的随机性
  确保了 randomNumber 在 {0,...,2^256-1} 上均匀分布
- Provider 无法预测 randomNumber（否则可解决 SHA-256 preimage 问题）

情况 B：User 恶意，Provider 诚实
- Provider 已提交 providerSeedHash，providerSeed 对 User 不可见
- User 无法通过穷举 userSeed 使 H(providerSeed ⊕ userSeed) = 目标值
  （providerSeed 的不可知性 = 2^256 熵）
- User 无法预测 randomNumber

情况 C：双方均恶意
- 此时 Casino 合约本身已被攻破，超出了随机数安全的范畴

结论：只要至少一方提供真随机性，输出就是不可预测的。□
```

#### 属性 2：可验证性（Verifiability）

- 每个随机数请求绑定唯一的 `sequenceNumber`
- Provider 提供的 VRF 证明 π 可以链上验证：`VRF_verify(pk, input, output, π) = true`
- 任何人可以独立验证 Provider 没有替换 seed

#### 属性 3：1-of-2 诚实假设（1-of-2 Honesty）

**最强安全保证**：即使 Provider 或 User 中一方完全恶意，只要另一方诚实提供随机种子，输出就是安全的。

```
安全边界：min(H(providerSeed), H(userSeed)) 的熵
实际熵：至少 128 位（单方安全随机种子的最小要求）
```

### 2.4 威胁模型分析

| 威胁 | 攻击者能力 | 防御机制 | 残余风险 |
|------|-----------|---------|---------|
| 恶意 Provider | 控制 providerSeed 选择 | User 提供随机 userSeed | Provider 可拒绝回调（DoS） |
| 恶意 User | 控制 userSeed 选择 | Provider 预先承诺 seed | User 可提交多次请求（Gas 损失） |
| 链上 Revert 攻击 | 在同一 tx 中预测结果并 revert | 随机数在**回调 tx** 中产生 | **无效** — 无法在请求 tx 中预知 |
| 验证者操控 | 选择有利区块的 prevrandao | 随机数来自 Pyth 网络，不依赖区块变量 | 无 |
| 重放攻击 | 使用过期的随机数 | sequenceNumber 唯一绑定每次请求 | 无 |
| Eclipse 攻击 | 隔离合约，伪造回调 | `onlyEntropy` 检查确保只有 Entropy 合约可回调 | 极低 |

#### 特别说明：Revert-if-Unfavorable 攻击为何无效

```
传统区块随机数（有漏洞）：
  1. 用户 tx → 同一 tx 内计算随机数 → 攻击者可预览并 revert

Pyth Entropy（无此漏洞）：
  1. 用户 tx → 发送 requestWithCallback → 返回 sequenceNumber
  2. [随机数在链下生成，无法在请求 tx 中预测]
  3. 独立的回调 tx → 传入 randomNumber → 执行游戏逻辑

攻击者无法控制第 3 步的内容，因为这发生在一个独立的交易中，
而且 randomNumber 是 Provider 的 VRF 输出，攻击者无法预测。
```

### 2.5 使用指南

#### 步骤 1：获取 HyperEVM 上的合约地址

```bash
# 访问 Pyth Entropy Explorer
# https://entropy-explorer.pyth.network/
# 选择 Chain ID 999 (HyperEVM Mainnet)
# 获取 Entropy 合约地址和默认 Provider 地址
```

#### 步骤 2：实现消费者接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEntropy.sol";

contract MyGame is IEntropyConsumer {
    IEntropy public immutable entropy;
    address public immutable provider;

    // 关键：存储 sequenceNumber 到游戏的映射
    mapping(uint64 => uint256) public seqToGameId;

    constructor(address _entropy, address _provider) {
        entropy = IEntropy(_entropy);
        provider = _provider;
    }

    // 用户请求随机数
    function requestGame(uint256 userGuess, bytes32 userSeed)
        external payable returns (uint256 gameId)
    {
        uint128 fee = entropy.getFee(provider);
        require(msg.value >= fee + MIN_BET, "Insufficient value");

        // CEI 原则：先存储游戏数据，再调用外部合约
        gameId = _createGame(msg.sender, userGuess, msg.value - fee);

        // 请求随机数
        uint64 seqNum = entropy.requestWithCallback{value: fee}(
            provider,
            userSeed  // 用户提供的熵（任意 bytes32，越随机越好）
        );

        seqToGameId[seqNum] = gameId;
    }

    // Pyth 回调（只有 Entropy 合约可调用）
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider (验证已由 Entropy 合约完成)
        bytes32 randomNumber
    ) external override {
        require(msg.sender == address(entropy), "Only Entropy");

        uint256 gameId = seqToGameId[sequenceNumber];
        _resolveGame(gameId, randomNumber);
    }

    function getEntropy() external view override returns (address) {
        return address(entropy);
    }
}
```

#### 步骤 3：前端生成用户种子

```typescript
import { ethers } from 'ethers';

// 方法 1：完全随机（最安全）
const userSeed = ethers.hexlify(ethers.randomBytes(32));

// 方法 2：基于用户输入（增加用户参与感）
const userInput = "player-chosen-lucky-number-42";
const userSeed = ethers.keccak256(
    ethers.toUtf8Bytes(userInput + Date.now().toString())
);

// 发送请求
const fee = await contract.getRequestFee();
const tx = await contract.requestGame(guess, userSeed, {
    value: fee + betAmount
});
```

#### 步骤 4：监听回调事件

```typescript
// 监听 GameResolved 事件（在回调 tx 中触发）
contract.on("GameResolved", (gameId, player, guess, result, won) => {
    if (player === userAddress) {
        updateGameResult(gameId, result, won);
    }
});

// 或者轮询游戏状态
const pollResult = async (gameId: bigint) => {
    for (let i = 0; i < 30; i++) {
        const game = await contract.getGame(gameId);
        if (game.state === 1 /* COMPLETED */) return game;
        await sleep(1000);
    }
};
```

---

## 3. Proof of Play vRNG — 技术分析

### 3.1 drand 协议原理

drand（Distributed Randomness Beacon）是一个运行在多方之间的**公开可验证随机数信标**，每隔固定时间产生一个新的随机值。

**核心设计目标**：
1. **不可预测性**：任何参与方无法提前知道未来的随机数
2. **不可偏见性**：参与方无法操控随机数使其偏向特定值
3. **公开可验证性**：任何人可以验证随机数的正确性，无需信任
4. **高可用性**：即使部分节点故障，信标仍能正常运行

**drand 的两种模式**：
- `chained`（链式）：每轮随机数依赖上一轮（旧版）
- `unchained`（非链式）：每轮独立，支持并行验证（当前主流）

### 3.2 阈值 BLS 签名数学基础

#### 椭圆曲线配对

drand 使用 BLS12-381 曲线，这是一条 pairing-friendly 椭圆曲线：
- 群 G1 和 G2（不同的子群）
- 双线性配对：e: G1 × G2 → GT

BLS 签名的核心属性：
```
密钥生成：
  sk ← Zp  (随机私钥)
  pk = sk · G2  (公钥，G2 上的点)

签名：
  σ = sk · H(msg)  (H: {0,1}* → G1)

验证：
  e(σ, G2) = e(H(msg), pk)

等价于：e(sk·H(msg), G2) = e(H(msg), sk·G2)
（由配对的双线性性质保证）
```

#### Shamir 秘密分享 + 分布式密钥生成

**问题**：如何让 n 个参与方共同持有一个私钥 sk，而没有任何人知道完整的 sk？

**Shamir 秘密分享（t-of-n）**：
```
设置阶段：
  选择随机多项式 f(x) = a0 + a1·x + a2·x² + ... + a_{t-1}·x^{t-1}
  其中 a0 = sk（要保密的值）

  每个参与方 i 收到：ski = f(i) (mod p)
  这是他们的私钥分片

重建阶段（给定 t 个分片）：
  使用 Lagrange 插值重建 f(0) = sk
  sk = Σ ski · λi  (其中 λi 是 Lagrange 系数)
```

**分布式密钥生成（DKG）**：
```
drand 使用 Pedersen's DKG 协议：
1. 每个参与方独立选择随机多项式 fi(x)
2. 向其他参与方广播承诺：Ci = {fi(0)·G, fi(1)·G, ..., fi(t-1)·G}
3. 秘密发送分片：sij = fi(j) 给参与方 j
4. 每个参与方验证收到的分片与承诺一致
5. 合并所有分片：私钥分片 sk_i = Σ s_{j,i}

结果：
- 完整私钥 sk = Σ fi(0) 存在于数学意义上，但无人知晓
- 每个参与方持有 sk 的 Shamir 分片
- 公钥 pk = sk·G2 可以公开计算
```

#### 阈值签名过程

```
每一轮 drand 随机数生成：

1. 构造消息：
   msg = H(round_number || prev_signature)  // 链式模式
   或
   msg = H(round_number)                     // 非链式模式

2. 每个参与方生成部分签名：
   σ_i = sk_i · H(msg)   // 在 G1 上

3. 聚合 t 个部分签名（Lagrange 插值）：
   σ = Σ λ_i · σ_i
   其中 λ_i 是 Lagrange 系数（公开已知）

4. 验证聚合签名：
   e(σ, G2) = e(H(msg), pk)

5. 生成随机数：
   randomness = SHA256(σ)
```

### 3.3 League of Entropy 组成

drand 由 League of Entropy（LoE）运营，成员涵盖全球不同类型的机构：

| 机构 | 类型 | 地区 |
|------|------|------|
| Protocol Labs | 区块链研究 | 美国 |
| Cloudflare | 云计算/CDN | 美国 |
| EPFL (瑞士联邦理工学院) | 学术研究 | 瑞士 |
| Kudelski Security | 网络安全 | 瑞士 |
| Universidad de Chile | 学术研究 | 智利 |
| QRL Foundation | 量子安全 | 英国 |
| C4DT | 数字信任 | 瑞士 |
| Randamu | 随机数专业 | 美国 |
| Ethereum Foundation | 区块链研究 | 全球 |
| ... | ... | ... |

**机构多样性保证**：
- 不同国家：不受单一司法管辖区约束
- 不同类型：学术、商业、非营利、政府
- 不同基础设施：不同 ISP、数据中心、操作系统
- 不同利益关系：无共同的经济激励去合谋

当前配置阈值：需要超过半数机构（约 8+ 个）才能生成有效随机数。

### 3.4 安全属性证明

#### 属性 1：不可预测性（Unpredictability）

**定理**：假设 ECDLP 在 BLS12-381 上困难，BLS 签名满足 EUF-CMA 安全性。在少于 t 个参与方被攻破的情况下，对手无法预测下一轮的随机数。

```
证明框架：
假设攻击者 A 可以预测 randomness_{n+1} = SHA256(σ_{n+1})

则 A 必须能够预测 σ_{n+1}（反证）

σ_{n+1} 是私钥 sk 对消息 msg_{n+1} 的 BLS 签名
msg_{n+1} = H(round_{n+1} || σ_n)（已知）

若 A 知道 sk，则 A 可以伪造 BLS 签名 → 矛盾 EUF-CMA 安全性
若 A 不知道 sk，则 A 必须通过 t 个以上的分片重建 sk
  → 需要攻破 t 个以上的独立节点 → 假设 f < t 个被攻破，矛盾

因此 A 无法预测 randomness_{n+1}。□
```

#### 属性 2：不可偏见性（Bias-Resistance）

```
假设攻击者控制了 f < t 个节点，试图让随机数偏向特定值 r*。

方案一：修改部分签名
  - 攻击者控制 σ_i（其中 i 是被控制的节点集合，|集合| < t）
  - 诚实节点提供 t - f > 0 个正确的部分签名
  - 由于 BLS 签名的代数结构，修改 f 个部分签名可以改变最终聚合签名
  - 但：攻击者无法预测修改后的 σ_i 会使 SHA256(σ_aggregate) 等于目标值 r*
  - 这相当于在不知道 SHA256 原像的情况下找到特定哈希值（SHA256 preimage 困难性）

方案二：选择性不参与
  - 攻击者可以不提交部分签名，延迟轮次生成
  - 但无法强制使特定的"下一轮"签名等于目标值

结论：在密码学假设成立的前提下，攻击者无法使随机数偏向特定值。□
```

#### 属性 3：公开可验证性（Public Verifiability）

drand 的每个输出都包含：
```json
{
  "round": 12345,
  "randomness": "...",
  "signature": "...",
  "previous_signature": "..."
}
```

任何人都可以验证：
```python
# 验证算法
def verify_drand(round_n, randomness, signature, prev_sig, pk):
    # 1. 构造消息
    msg = H(round_n || prev_sig)

    # 2. 验证 BLS 签名
    assert pairing_check(signature, G2, H(msg), pk)

    # 3. 验证随机数
    assert randomness == SHA256(signature)

    return True
```

### 3.5 威胁模型分析

| 威胁 | 要求能力 | 现实可行性 | 防御 |
|------|---------|-----------|------|
| 合谋操控随机数 | 控制 t(≈n/2) 个 LoE 机构 | 极低（跨国、跨类型机构） | 机构多样性、公开审计 |
| PoP 服务不诚实 | PoP 替换 drand 输出 | 低（可被检测） | 链上验证 drand 签名（高 gas）|
| 拒绝服务攻击 | 使 t 个以上节点离线 | 极低（全球分布式基础设施） | LoE 的高可用性设计 |
| 重放旧轮次随机数 | 无需额外能力 | 理论可能 | traceId/requestId 与每次请求绑定 |
| 时间窗口攻击 | 预测 drand 回调时间 | 无效 | drand 轮次不可预测 |

#### 关于 PoP 服务的额外分析

Proof of Play vRNG 在 drand 和您的合约之间充当中间层。这引入了一个信任假设：**您信任 PoP 传递了正确的 drand 输出**。

风险分析：
- PoP **无法伪造** drand 随机数（BLS 签名不可伪造）
- PoP **可以** 选择不传递随机数（拒绝服务），但这有经济激励反对
- PoP **可能** 传递过期的旧随机数（防御：在合约中验证 drand 轮次号）

**增强安全性**（可选）：在合约中验证 drand 签名（但 gas 成本高，约 500K gas 用于 BLS 验证）：
```solidity
// 高安全性方案：链上验证 drand BLS 签名
// 需要 BLS12-381 预编译或库
function verifyDrandSignature(
    uint256 round,
    bytes32 randomness,
    bytes memory signature
) internal view returns (bool) {
    bytes memory message = abi.encodePacked(round);
    return BLS.verify(DRAND_PUBLIC_KEY, message, signature);
}
```

### 3.6 使用指南

#### 步骤 1：申请白名单

```
1. 访问：https://docs.proofofplay.com/services/vrng/about
2. 联系 Proof of Play 团队申请注册
3. 提供：合约地址、使用场景、预期调用频率
4. 获得授权后，您的合约地址会被加入白名单
```

#### 步骤 2：实现消费者接口

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IProofOfPlayVRNG.sol";

contract MyGame is IVRNGConsumer {
    IProofOfPlayVRNG public immutable vrng;
    address public immutable vrngCallbackSender;

    // 双重映射：requestId -> gameId, traceId -> gameId
    mapping(uint256 => uint256) public requestToGame;
    mapping(uint256 => uint256) public traceToGame;
    uint256 public traceCounter;

    // vRNG 合约地址（HyperEVM 主网）
    address constant POP_VRNG = 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1;

    constructor(address _callbackSender) {
        vrng = IProofOfPlayVRNG(POP_VRNG);
        vrngCallbackSender = _callbackSender;
    }

    function requestGame(uint256 userGuess) external payable returns (uint256 gameId) {
        uint256 traceId = ++traceCounter;

        // CEI：先存储，再请求
        gameId = _createGame(msg.sender, userGuess, msg.value);
        traceToGame[traceId] = gameId;

        // 请求随机数
        uint256 requestId = vrng.requestRandomNumberWithTraceId(traceId);
        requestToGame[requestId] = gameId;
    }

    // PoP 服务回调
    function receiveRandomNumber(
        uint256 requestId,
        uint256 randomNumber
    ) external override {
        require(msg.sender == vrngCallbackSender, "Only vRNG");

        uint256 gameId = requestToGame[requestId];
        _resolveGame(gameId, randomNumber);
    }
}
```

#### 步骤 3：本地测试

```bash
# 使用 MockProofOfPlayVRNG 进行本地测试
# （不需要白名单，自动模拟回调）
anvil --fork-url https://rpc.hyperliquid.xyz/evm

# 部署 Mock 版本
forge script script/Deploy.s.sol:DeployLocal \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast
```

---

## 4. 方案对比与选择建议

### 4.1 技术对比

| 维度 | Pyth Entropy | Proof of Play vRNG |
|------|-------------|-------------------|
| **密码学基础** | 双方承诺揭示协议（Dual Commit-Reveal） | 阈值 BLS + Shamir 秘密分享 |
| **信任假设** | 1-of-2（Provider 和 User 各一方诚实） | t-of-n（LoE 大多数机构诚实） |
| **去中心化程度** | 中（依赖 Pyth 网络 Guardian 节点） | 高（16+ 独立机构） |
| **链上可验证性** | ⚠️ 承诺哈希可审计（非完整链上 VRF 证明） | ⚠️ 需要 BLS 预编译（高 gas）|
| **延迟** | ~1-3 秒（异步回调） | ~1-3 秒（异步回调） |
| **使用成本** | entropy fee（小额） | 免费（需注册白名单）|
| **HyperEVM 合约** | 查询 entropy-explorer.pyth.network | 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1 |
| **准入要求** | 无（开放使用） | 需申请白名单 |

### 4.2 选择建议

```
场景 A：快速上线，无需繁琐申请
  → 选择 Pyth Entropy
  优势：即插即用，无需白名单

场景 B：最高去中心化程度
  → 选择 Proof of Play vRNG
  优势：drand 的机构多样性提供最强的信任分散

场景 C：最高安全性（不计成本）
  → 两者结合
  方案：使用两个 VRF 的输出进行异或
  randomNumber = pythOutput XOR drandOutput
  任何一方安全则整体安全

场景 D：测试和快速原型
  → 先用 Commit-Reveal，上线前切换到 Pyth/PoP
```

### 4.3 组合使用（最高安全）

```solidity
// 双 VRF 组合方案
contract UltraSecureDice {
    // 使用两个独立 VRF，任一方诚实则安全
    bytes32 public pendingPythOutput;
    uint256 public pendingDrandOutput;
    bool public hasPyth;
    bool public hasDrand;

    function finalize() internal {
        if (!hasPyth || !hasDrand) return;

        // 组合两个独立来源
        uint256 combined = uint256(
            keccak256(abi.encodePacked(pendingPythOutput, pendingDrandOutput))
        );
        result = (combined % SIDES) + 1;
    }
}
```

---

## 5. 集成安全检查清单

### 合约安全

- [ ] 遵循 CEI 原则：先存储游戏数据，再调用 VRF 合约
- [ ] `onlyEntropy` / `onlyVRNG` 修饰符保护回调函数
- [ ] 处理 VRF 回调未到达的情况（超时退款机制）
- [ ] 游戏状态机：PENDING → COMPLETED，防止重复处理
- [ ] 房屋资金保护：回调前锁定可能的赔付金额
- [ ] 防止重入：使用 ReentrancyGuard 或 checks-effects-interactions

### 前端安全

- [ ] 用户种子使用 `crypto.getRandomValues()` 生成（不要用 Math.random()）
- [ ] 向用户显示种子哈希，允许独立验证
- [ ] 实现事件监听而非轮询（更可靠）
- [ ] 处理回调超时的 UI 状态

### 运营安全

- [ ] 监控 VRF 回调延迟，异常告警
- [ ] 保留游戏日志用于争议仲裁
- [ ] 定期验证 Pyth/PoP 合约地址未被替换
- [ ] 设置紧急暂停功能（`Pausable`）

### 经济安全

- [ ] 设置最大单笔赌注上限（防止单次攻击影响过大）
- [ ] 维护足够的房屋资金（不低于 MAX_PAYOUT × 并发游戏数）
- [ ] 考虑赔率设置（建议保留 1-5% 的房屋优势）
