export type GameState = "PENDING" | "COMPLETED" | "REFUNDED" | "EXPIRED";

export interface RollResult {
  gameId?: bigint;
  guess: number;
  result?: number;
  won?: boolean;
  betAmount: bigint;
  payout?: bigint;
  txHash?: string;
  state: "submitting" | "pending" | "completed" | "error";
  errorMsg?: string;
  timestamp: number;
  randomSource?: string;
}

export interface RNGMethod {
  id: string;
  name: string;
  shortName: string;
  securityLevel: "insecure" | "medium" | "secure";
  securityScore: number; // 1-10
  description: string;
  howItWorks: string[];
  attackVectors: string[];
  latency: string;
  cost: string;
  trustModel: string;
  color: string;
  icon: string;
}

export const RNG_METHODS: RNGMethod[] = [
  {
    id: "block",
    name: "Block Variables",
    shortName: "Block RNG",
    securityLevel: "insecure",
    securityScore: 1,
    description: "使用 block.prevrandao + block.timestamp 生成随机数",
    howItWorks: [
      "在同一笔交易中读取 block.prevrandao",
      "与 block.timestamp 和 msg.sender 混合哈希",
      "取模得到骰子结果",
    ],
    attackVectors: [
      "⚠️ 验证者可选择性不出块来重新抽取 prevrandao",
      "⚠️ 攻击者合约可预览结果并在不利时 revert",
      "⚠️ HyperEVM 只有 ~24 个验证者，攻击成本极低",
      "⚠️ MEV 机器人可读取待定交易后前运行",
    ],
    latency: "即时（同一交易）",
    cost: "0（仅 gas）",
    trustModel: "完全不可信 — 验证者可操控",
    color: "red",
    icon: "🔴",
  },
  {
    id: "commit",
    name: "Commit-Reveal",
    shortName: "Commit-Reveal",
    securityLevel: "medium",
    securityScore: 5,
    description: "庄家预先承诺 serverSeedHash，玩家提交明文 userSeed（合约内部哈希保存），庄家揭示结算",
    howItWorks: [
      "阶段1 (Commit): 玩家提交明文 userSeed + 猜测 + 押注（合约内部哈希存储）",
      "庄家已预先提交 serverSeedHash（在接受押注前）",
      "阶段2 (Reveal): 庄家揭示 serverSeed，合约验证双方承诺后结算",
      "结果 = hash(serverSeed, userSeed, blockhash, player)",
    ],
    attackVectors: [
      "⚠️ 庄家可能拒绝揭示（输局时卷款跑路）",
      "⚠️ 需要设置超时机制防止庄家不揭示",
      "✅ 玩家无法操控（seed 已承诺）",
      "✅ 庄家无法操控（seed 在玩家承诺前已锁定）",
    ],
    latency: "2 笔交易（~2-4 秒）",
    cost: "2x gas",
    trustModel: "半信任 — 需信任庄家会揭示",
    color: "yellow",
    icon: "🟡",
  },
  {
    id: "pyth",
    name: "Pyth Entropy",
    shortName: "Pyth VRF",
    securityLevel: "secure",
    securityScore: 9,
    description: "Pyth 网络提供的可验证随机函数，双方均无法操控",
    howItWorks: [
      "用户提供 userSeed（增加额外熵）",
      "Pyth 提供商已预先承诺其随机种子",
      "结果 = hash(userSeed XOR providerSeed)",
      "Pyth 回调合约 entropyCallback() 传入可验证随机数",
    ],
    attackVectors: [
      "✅ 用户和提供商均无法单独控制输出",
      "✅ 提供商种子在用户请求前已承诺",
      "⚠️ 承诺哈希可审计（非完整链上 VRF 证明）",
      "⚠️ 需要信任 Pyth 网络基础设施",
    ],
    latency: "异步（1-3 秒）",
    cost: "小额 entropy 费用 + gas",
    trustModel: "去中心化 — Pyth oracle 网络",
    color: "green",
    icon: "🟢",
  },
  {
    id: "pop",
    name: "Proof of Play vRNG",
    shortName: "PoP vRNG",
    securityLevel: "secure",
    securityScore: 9,
    description: "基于 drand（League of Entropy）的分布式随机数服务",
    howItWorks: [
      "合约调用 requestRandomNumberWithTraceId()",
      "vRNG 服务从 drand 获取随机数",
      "drand 由 16+ 个独立机构（Protocol Labs、Cloudflare、EPFL 等）运行",
      "vRNG 服务回调 receiveRandomNumber()",
    ],
    attackVectors: [
      "✅ 需要 1/3+ 的阈值签名者勾结才能操控",
      "✅ 公开可验证的随机数信标",
      "✅ 无单点故障",
      "⚠️ 需要向 Proof of Play 注册白名单",
    ],
    latency: "异步（1-3 秒）",
    cost: "仅 gas（目前免费）",
    trustModel: "去中心化 — League of Entropy",
    color: "green",
    icon: "🟢",
  },
];
