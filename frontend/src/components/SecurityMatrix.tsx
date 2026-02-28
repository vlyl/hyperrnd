import { RNG_METHODS } from "../types";

const CRITERIA = [
  { key: "manipulation", label: "防操控性", desc: "验证者/攻击者无法操控结果" },
  { key: "verifiable", label: "可验证性", desc: "任何人可以验证随机数的公平性" },
  { key: "latency", label: "低延迟", desc: "获取随机数的速度" },
  { key: "cost", label: "低成本", desc: "使用费用（不含 gas）" },
  { key: "trust", label: "无需信任", desc: "无需信任任何单一方" },
];

const SCORES: Record<string, Record<string, number>> = {
  block: { manipulation: 0, verifiable: 0, latency: 10, cost: 10, trust: 0 },
  commit: { manipulation: 6, verifiable: 7, latency: 6, cost: 8, trust: 4 },
  pyth: { manipulation: 9, verifiable: 9, latency: 7, cost: 6, trust: 8 },
  pop: { manipulation: 9, verifiable: 9, latency: 7, cost: 9, trust: 9 },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 8 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-4">{score}</span>
    </div>
  );
}

export function SecurityMatrix() {
  return (
    <div className="bg-casino-card border border-casino-border rounded-xl p-6">
      <h2 className="text-xl font-bold text-white mb-2">安全性对比矩阵</h2>
      <p className="text-gray-400 text-sm mb-6">
        在 HyperEVM 上，各种随机数方案的安全属性对比（满分 10）
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-casino-border">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">评估维度</th>
              {RNG_METHODS.map((m) => (
                <th key={m.id} className="py-3 px-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>{m.icon}</span>
                    <span
                      className={`font-semibold ${
                        m.securityLevel === "insecure"
                          ? "text-red-400"
                          : m.securityLevel === "medium"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {m.shortName}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr
                key={c.key}
                className="border-b border-casino-border/50 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="font-medium text-white">{c.label}</div>
                  <div className="text-xs text-gray-500">{c.desc}</div>
                </td>
                {RNG_METHODS.map((m) => (
                  <td key={m.id} className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <ScoreBar score={SCORES[m.id]?.[c.key] ?? 0} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}

            {/* Overall security score */}
            <tr className="bg-white/5">
              <td className="py-4 px-4">
                <div className="font-bold text-white">综合安全评分</div>
                <div className="text-xs text-gray-500">加权平均（防操控性权重 3x）</div>
              </td>
              {RNG_METHODS.map((m) => {
                const s = SCORES[m.id] ?? {};
                const weighted =
                  (s.manipulation * 3 + s.verifiable * 2 + s.latency + s.cost + s.trust * 2) / 9;
                return (
                  <td key={m.id} className="py-4 px-4 text-center">
                    <div
                      className={`text-2xl font-bold ${
                        weighted >= 8
                          ? "text-green-400"
                          : weighted >= 5
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {weighted.toFixed(1)}
                    </div>
                    <div
                      className={`text-xs mt-1 px-2 py-0.5 rounded-full inline-block ${
                        m.securityLevel === "insecure"
                          ? "bg-red-900/50 text-red-300"
                          : m.securityLevel === "medium"
                          ? "bg-yellow-900/50 text-yellow-300"
                          : "bg-green-900/50 text-green-300"
                      }`}
                    >
                      {m.securityLevel === "insecure"
                        ? "不安全"
                        : m.securityLevel === "medium"
                        ? "中等"
                        : "安全"}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Attack vector warning */}
      <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
        <h3 className="text-red-400 font-semibold mb-2">
          ⚠️ HyperEVM 特殊安全考量
        </h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>
            • HyperEVM 只有 <strong className="text-white">~21 个验证者</strong>，
            validator 操控 prevrandao 的成本极低
          </li>
          <li>
            • <code className="text-red-300">block.prevrandao</code> 不来自可验证的随机性信标，
            与以太坊主网的 RANDAO 完全不同
          </li>
          <li>
            • 任何使用区块变量的赌场应用都<strong className="text-red-300">必然被攻击</strong>，
            因为对手只需等待有利区块即可
          </li>
        </ul>
      </div>
    </div>
  );
}
