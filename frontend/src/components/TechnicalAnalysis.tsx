import { useState, useEffect, useRef, useCallback } from "react";

// ─── Data ────────────────────────────────────────────────────────────────────

const TOC = [
  { id: "s0", label: "HyperEVM 随机数安全考量", level: 1 },
  { id: "s0-1", label: "为何 HyperEVM 更危险", level: 2 },
  { id: "s0-2", label: "具体攻击向量", level: 2 },
  { id: "s1", label: "Pyth Entropy — 技术分析", level: 1 },
  { id: "s1-1", label: "密码学基础", level: 2 },
  { id: "s1-2", label: "协议流程", level: 2 },
  { id: "s1-3", label: "安全属性证明", level: 2 },
  { id: "s1-4", label: "威胁模型分析", level: 2 },
  { id: "s1-5", label: "使用指南", level: 2 },
  { id: "s2", label: "Proof of Play vRNG — 技术分析", level: 1 },
  { id: "s2-1", label: "drand 协议原理", level: 2 },
  { id: "s2-2", label: "阈值 BLS 签名数学基础", level: 2 },
  { id: "s2-3", label: "League of Entropy 组成", level: 2 },
  { id: "s2-4", label: "安全属性证明", level: 2 },
  { id: "s2-5", label: "威胁模型分析", level: 2 },
  { id: "s2-6", label: "使用指南", level: 2 },
  { id: "s3", label: "方案对比与选择建议", level: 1 },
  { id: "s4", label: "集成安全检查清单", level: 1 },
];

// ─── Helper Components ───────────────────────────────────────────────────────

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      {children}
    </section>
  );
}

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-bold text-white mt-10 mb-4 pb-3 border-b border-casino-border flex items-center gap-3">
      {children}
    </h2>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-blue-300 mt-8 mb-3 flex items-center gap-2">
      <span className="w-1 h-5 bg-blue-500 rounded-full inline-block" />
      {children}
    </h3>
  );
}

function Callout({
  type,
  title,
  children,
}: {
  type: "danger" | "warning" | "info" | "success" | "proof";
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    danger: "bg-red-900/20 border-red-500/50 text-red-200",
    warning: "bg-yellow-900/20 border-yellow-500/50 text-yellow-200",
    info: "bg-blue-900/20 border-blue-500/50 text-blue-200",
    success: "bg-green-900/20 border-green-500/50 text-green-200",
    proof: "bg-purple-900/20 border-purple-500/50 text-purple-200",
  };
  const icons = {
    danger: "🚨",
    warning: "⚠️",
    info: "ℹ️",
    success: "✅",
    proof: "📐",
  };
  return (
    <div className={`border rounded-xl p-5 my-4 ${styles[type]}`}>
      <div className="font-semibold mb-2 flex items-center gap-2">
        <span>{icons[type]}</span>
        {title}
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Code({ children, language = "" }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between bg-gray-900 rounded-t-lg px-4 py-2 border border-casino-border border-b-0">
        <span className="text-xs text-gray-500 font-mono">{language || "code"}</span>
        <button
          onClick={copy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
      </div>
      <pre className="bg-gray-950 rounded-b-lg p-4 overflow-x-auto text-xs font-mono text-green-300 border border-casino-border border-t-0 leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MathBlock({ children }: { children: string }) {
  return (
    <div className="bg-gray-900/70 border border-purple-500/30 rounded-xl p-4 my-4 font-mono text-sm text-purple-200 overflow-x-auto leading-relaxed">
      <pre className="whitespace-pre-wrap">{children}</pre>
    </div>
  );
}

function ThreatTable({ rows }: { rows: string[][] }) {
  const headers = ["威胁", "攻击者能力", "防御机制", "残余风险"];
  const colors = ["text-red-300", "text-gray-300", "text-green-300", "text-yellow-300"];
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-casino-border">
            {headers.map((h, i) => (
              <th key={i} className={`text-left py-2 px-3 font-semibold ${colors[i]} text-xs`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-casino-border/50 hover:bg-white/5">
              {row.map((cell, j) => (
                <td key={j} className={`py-3 px-3 text-xs ${j === 0 ? "font-medium text-white" : "text-gray-400"} align-top`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable() {
  const rows = [
    ["密码学基础", "双方承诺揭示协议", "阈值 BLS + Shamir 秘密分享"],
    ["信任假设", "1-of-2（双方至少一方诚实）", "t-of-n（LoE 大多数机构诚实）"],
    ["去中心化程度", "中（Pyth Guardian 网络）", "高（16+ 独立跨国机构）"],
    ["链上可验证性", "⚠️ 承诺哈希可审计（非完整链上 VRF 证明）", "⚠️ 需 BLS 预编译（高 gas）"],
    ["响应延迟", "~1–3 秒异步回调", "~1–3 秒异步回调"],
    ["使用成本", "entropy fee（小额）", "当前免费（需注册）"],
    ["HyperEVM 合约", "查 entropy-explorer.pyth.network", "0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1"],
    ["准入要求", "无（开放使用）", "需申请白名单"],
  ];
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-casino-border">
            <th className="text-left py-2 px-3 text-gray-400 text-xs">维度</th>
            <th className="text-left py-2 px-3 text-green-400 text-xs">Pyth Entropy</th>
            <th className="text-left py-2 px-3 text-green-400 text-xs">PoP vRNG (drand)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([dim, pyth, pop], i) => (
            <tr key={i} className="border-b border-casino-border/50 hover:bg-white/5">
              <td className="py-2 px-3 text-xs font-medium text-gray-300 align-top">{dim}</td>
              <td className="py-2 px-3 text-xs text-gray-400 align-top">{pyth}</td>
              <td className="py-2 px-3 text-xs text-gray-400 align-top">{pop}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistGroup({ title, items }: { title: string; items: string[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setChecked((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  return (
    <div className="bg-casino-card border border-casino-border rounded-xl p-5 mb-4">
      <h4 className="font-semibold text-white mb-3">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            onClick={() => toggle(i)}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs transition-all ${
                checked.has(i)
                  ? "bg-green-500 border-green-500 text-black"
                  : "border-gray-600 group-hover:border-green-500"
              }`}
            >
              {checked.has(i) ? "✓" : ""}
            </span>
            <span
              className={`text-sm transition-colors ${
                checked.has(i) ? "text-gray-500 line-through" : "text-gray-300"
              }`}
            >
              {item}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-gray-500">
        {checked.size}/{items.length} 已完成
      </div>
    </div>
  );
}

// ─── Protocol Flow Diagram ────────────────────────────────────────────────────

function PythFlowDiagram() {
  return (
    <div className="bg-gray-950 border border-casino-border rounded-xl p-4 my-4 overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex justify-around text-xs font-mono text-gray-400 mb-2">
          <span className="text-blue-300">Provider (链下)</span>
          <span className="text-gray-300">Entropy 合约</span>
          <span className="text-yellow-300">用户 (dApp)</span>
        </div>
        <div className="flex justify-around mb-1">
          {["border-blue-500/50", "border-gray-600", "border-yellow-500/50"].map((c, i) => (
            <div key={i} className={`border-l-2 ${c} h-px w-px relative`} />
          ))}
        </div>

        {/* Steps */}
        {[
          {
            from: 0, to: 1, label: "commitProvider(hash(providerSeed))",
            color: "border-blue-500", text: "text-blue-300",
          },
          {
            from: 2, to: 1, label: "requestWithCallback(userSeed, fee)",
            color: "border-yellow-500", text: "text-yellow-300", right: true,
          },
          {
            from: 1, to: 2, label: "emit Request(sequenceNumber)",
            color: "border-gray-500", text: "text-gray-300",
          },
          {
            from: 1, to: 0, label: "notify(sequenceNumber, userSeed)",
            color: "border-gray-500", text: "text-gray-300",
          },
          {
            from: 0, to: 1, label: "entropyCallback(seqNum, randomNum, proof)",
            color: "border-green-500", text: "text-green-300",
          },
          {
            from: 1, to: 2, label: "entropyCallback(seqNum, provider, randomNum)",
            color: "border-green-500", text: "text-green-300",
          },
        ].map((step, i) => (
          <div key={i} className="flex items-center my-2 text-xs font-mono">
            <div className="w-1/3 flex justify-center">
              {step.from === 0 && (
                <div className={`border-t-2 ${step.color} flex-1 relative`}>
                  <div className="absolute right-0 top-[-5px] text-xs">→</div>
                </div>
              )}
              {step.from === 1 && step.to === 0 && (
                <div className={`border-t-2 ${step.color} flex-1 relative`}>
                  <div className="absolute left-0 top-[-5px] text-xs">←</div>
                </div>
              )}
            </div>
            <div className={`w-1/3 text-center ${step.text} px-2`}>{step.label}</div>
            <div className="w-1/3 flex justify-center">
              {step.to === 2 && (
                <div className={`border-t-2 ${step.color} flex-1 relative`}>
                  <div className="absolute right-0 top-[-5px] text-xs">→</div>
                </div>
              )}
              {step.from === 2 && (
                <div className={`border-t-2 ${step.color} flex-1 relative`}>
                  <div className="absolute left-0 top-[-5px] text-xs">←</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrandFlowDiagram() {
  const nodes = ["节点 1", "节点 2", "...", `节点 n`];
  return (
    <div className="bg-gray-950 border border-casino-border rounded-xl p-5 my-4">
      <div className="text-xs text-gray-400 font-mono mb-3 text-center">drand 轮次签名流程</div>
      <div className="flex flex-col gap-3">
        {/* Signing */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2 flex-1">
            {nodes.map((n, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-900/30 border border-blue-500/40 rounded-lg p-2 text-center text-xs text-blue-300"
              >
                {n}
                <div className="text-gray-500 mt-1">σ_{`{${i + 1}}`}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
          <div className="flex-1 border-t border-dashed border-gray-700" />
          <span className="text-xs text-gray-400 px-2">聚合 t 个部分签名（Lagrange 插值）</span>
          <div className="flex-1 border-t border-dashed border-gray-700" />
        </div>

        {/* Result */}
        <div className="flex gap-3 justify-center">
          <div className="bg-green-900/30 border border-green-500/40 rounded-lg px-4 py-2 text-center text-xs">
            <div className="text-green-300 font-mono">σ = Σ λ_i · σ_i</div>
            <div className="text-gray-500 mt-1">聚合签名（BLS）</div>
          </div>
          <div className="flex items-center text-gray-500">→</div>
          <div className="bg-purple-900/30 border border-purple-500/40 rounded-lg px-4 py-2 text-center text-xs">
            <div className="text-purple-300 font-mono">randomness = SHA256(σ)</div>
            <div className="text-gray-500 mt-1">最终随机数</div>
          </div>
        </div>

        {/* Verification */}
        <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-center">
          <span className="text-gray-500">任何人可验证：</span>{" "}
          <span className="text-yellow-300">e(σ, G₂) = e(H(msg), pk)</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TechnicalAnalysis() {
  const [activeSection, setActiveSection] = useState("s0");
  const mainRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Scrollspy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    TOC.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-8 relative" ref={mainRef}>
      {/* ── Left TOC sidebar ── */}
      <aside className="hidden xl:block w-64 flex-shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
            目录
          </div>
          <nav className="space-y-0.5">
            {TOC.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`w-full text-left transition-all duration-150 rounded-lg ${
                  item.level === 1 ? "px-2 py-1.5" : "px-5 py-1"
                } ${
                  activeSection === item.id
                    ? "bg-blue-500/15 text-blue-300"
                    : item.level === 1
                    ? "text-gray-300 hover:text-white hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                } ${item.level === 1 ? "text-xs font-semibold" : "text-xs"}`}
              >
                {activeSection === item.id && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 mb-0.5" />
                )}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Quick links */}
          <div className="mt-6 pt-4 border-t border-casino-border">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              外部资源
            </div>
            {[
              { label: "Pyth Entropy Explorer", url: "https://entropy-explorer.pyth.network/" },
              { label: "Pyth Entropy Docs", url: "https://docs.pyth.network/entropy" },
              { label: "PoP vRNG Docs", url: "https://docs.proofofplay.com/services/vrng/about" },
              { label: "drand 项目", url: "https://drand.love" },
              { label: "RFC 9381 (ECVRF)", url: "https://www.rfc-editor.org/rfc/rfc9381" },
            ].map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-2 py-1 text-xs text-gray-500 hover:text-blue-300 transition-colors"
              >
                ↗ {l.label}
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 max-w-4xl">
        {/* Hero */}
        <div className="mb-10 pb-8 border-b border-casino-border">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📐</span>
            <div>
              <h1 className="text-3xl font-bold text-white">可验证随机数技术安全论证</h1>
              <p className="text-gray-400 mt-1">针对 HyperEVM Casino 应用的密码学分析与使用指南</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Pyth Entropy", color: "bg-green-900/40 text-green-300 border-green-500/30" },
              { label: "Proof of Play vRNG", color: "bg-green-900/40 text-green-300 border-green-500/30" },
              { label: "drand (League of Entropy)", color: "bg-blue-900/40 text-blue-300 border-blue-500/30" },
              { label: "双方承诺揭示协议", color: "bg-purple-900/40 text-purple-300 border-purple-500/30" },
              { label: "阈值 BLS 签名", color: "bg-purple-900/40 text-purple-300 border-purple-500/30" },
            ].map((tag) => (
              <span key={tag.label} className={`px-3 py-1 rounded-full text-xs border ${tag.color}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 0: HyperEVM 安全考量                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Section id="s0">
          <H1>
            <span className="text-2xl">⚡</span>
            HyperEVM 随机数的特殊安全考量
          </H1>

          <p className="text-gray-400 leading-relaxed mb-4">
            在开始讨论安全的 VRF 方案之前，必须首先理解为什么在 HyperEVM 上随机数安全比以太坊主网更为复杂和严峻。
          </p>

          <Section id="s0-1">
            <H2>为何 HyperEVM 比以太坊主网更危险</H2>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              以太坊在 The Merge 后通过 EIP-4399 将 <code className="text-green-300 bg-gray-900 px-1 rounded">DIFFICULTY</code> 操作码替换为{" "}
              <code className="text-green-300 bg-gray-900 px-1 rounded">PREVRANDAO</code>，其值来源于
              Beacon Chain 的 RANDAO 累加器——每个 epoch 由数百个验证者 BLS 签名的 XOR 聚合。
              HyperEVM 的 <code className="text-green-300 bg-gray-900 px-1 rounded">block.prevrandao</code> 来源未文档化，且架构上不提供等价的安全保证：
            </p>

            <div className="overflow-x-auto my-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-casino-border bg-gray-900/50">
                    {["参数", "Ethereum Mainnet", "HyperEVM"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-gray-400 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["验证者数量", "~500,000", "~24"],
                    ["共识机制", "Ethereum PoS (Gasper)", "HyperBFT (HotStuff 变体)"],
                    ["prevrandao 来源", "Beacon RANDAO (BLS 聚合签名)", "未文档化（非 RANDAO）"],
                    ["单验证者出块概率", "~0.0002%", "~4.8%"],
                    ["操控 prevrandao 成本", "损失 16+ ETH + 惩罚", "仅损失 1 次出块奖励"],
                    ["Fast block 出块时间", "12 秒", "1 秒"],
                  ].map(([a, b, c]) => (
                    <tr key={a} className="border-b border-casino-border/50">
                      <td className="py-2 px-3 text-gray-300 font-medium">{a}</td>
                      <td className="py-2 px-3 text-gray-400">{b}</td>
                      <td className={`py-2 px-3 font-medium ${c.includes("24") || c.includes("4.2") || c.includes("1 次") || c.includes("1 秒") ? "text-red-400" : "text-gray-400"}`}>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="danger" title="核心风险">
              HyperEVM 只有约 24 个验证者，任意一个验证者都有约 4.2% 的概率成为某个区块的提议者。
              攻击成本极低：只需放弃一次出块奖励，就可以获得针对大额赌注游戏的随机数操控权。
            </Callout>
          </Section>

          <Section id="s0-2">
            <H2>具体攻击向量</H2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                {
                  icon: "🎯",
                  title: "验证者出块抑制攻击",
                  color: "border-red-500/40 bg-red-900/10",
                  steps: [
                    "验证者准备出块时计算 prevrandao 对应的游戏结果",
                    "若结果不利（Casino 会赢），选择放弃此次出块",
                    "等待下一个有利的 prevrandao 值再出块",
                    "成本：仅损失一次出块奖励（极小）",
                  ],
                },
                {
                  icon: "💥",
                  title: "Revert-if-Unfavorable 攻击",
                  color: "border-orange-500/40 bg-orange-900/10",
                  steps: [
                    "攻击者合约在同一区块中预览随机数结果",
                    "结果不利时，让合约 revert（不损失任何资金）",
                    "结果有利时，正常提交赌注",
                    "通过无限次重试直到赢得赌注",
                  ],
                },
              ].map((attack) => (
                <div key={attack.title} className={`border ${attack.color} rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{attack.icon}</span>
                    <span className="font-semibold text-sm text-white">{attack.title}</span>
                  </div>
                  <ol className="space-y-1.5">
                    {attack.steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-gray-400">
                        <span className="text-gray-600 flex-shrink-0">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <Code language="solidity">{`// 攻击者合约（演示 Revert-if-Unfavorable 原理）
contract BlockRNGAttacker {
    ICasinoDice public casino;

    function attack(uint256 guess) external payable {
        // 在同一区块/交易内预览结果（block.prevrandao 相同）
        (uint256 result, bool wouldWin) = casino.rollView(guess);

        if (!wouldWin) {
            // 不损失任何资金，仅损失 gas
            // 攻击者等待下一个有利区块
            revert("Unfavorable - will retry");
        }

        // 只有确定赢才提交，合约被榨干
        casino.roll{value: msg.value}(guess);
    }
}`}
            </Code>
          </Section>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 1: Pyth Entropy                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Section id="s1">
          <H1>
            <span className="text-2xl">🔵</span>
            Pyth Entropy — 技术分析
            <span className="ml-auto text-sm font-normal text-green-400 bg-green-900/30 border border-green-500/30 px-3 py-1 rounded-full">
              安全评级：9/10
            </span>
          </H1>

          <Section id="s1-1">
            <H2>密码学基础</H2>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Pyth Entropy 实现了<strong className="text-white">双方承诺-揭示协议（Dual Commit-Reveal Protocol）</strong>。
              按官方协议设计，Provider 种子通过链上哈希承诺可审计；并非每次请求均在链上提交完整 ECVRF 证明。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                {
                  icon: "🔒",
                  title: "SHA-256 哈希承诺",
                  props: [
                    ["抗碰撞性", "找到 x≠y 使 H(x)=H(y) 计算不可行"],
                    ["单向性", "给定 H(x)，反推 x 计算不可行"],
                    ["用途", "承诺方案的绑定性（Binding）保证"],
                  ],
                },
                {
                  icon: "📏",
                  title: "VRF 原理（参考）",
                  props: [
                    ["正确性", "合法生成的证明总能通过验证"],
                    ["唯一性", "给定 sk 和输入，输出唯一确定"],
                    ["伪随机性", "不知 sk 时，输出不可与随机值区分"],
                  ],
                },
              ].map((box) => (
                <div key={box.title} className="bg-casino-card border border-casino-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span>{box.icon}</span>
                    <span className="font-semibold text-sm text-white">{box.title}</span>
                  </div>
                  <dl className="space-y-1.5">
                    {box.props.map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <dt className="text-blue-300 flex-shrink-0 w-16">{k}</dt>
                        <dd className="text-gray-400">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            <MathBlock>{`VRF 核心构造参考（ECVRF，RFC 9381）：

给定：椭圆曲线 E，基点 G，私钥 sk，公钥 pk = sk·G

VRF_prove(sk, alpha):
  H     = encode_to_curve(alpha)   // 将输入映射到曲线点
  gamma = sk · H                   // VRF hash（核心值）
  k     = random_nonce()
  c     = Fiat-Shamir(pk, H, gamma, k·G, k·H)
  s     = k - c·sk (mod q)
  return (beta = SHA256(gamma), proof π = (gamma, c, s))

VRF_verify(pk, alpha, beta, π):
  U  = s·G + c·pk
  V  = s·H + c·gamma
  c' = Fiat-Shamir(pk, H, gamma, U, V)
  return c == c' AND beta == SHA256(gamma)`}</MathBlock>
          </Section>

          <Section id="s1-2">
            <H2>协议流程</H2>

            <p className="text-gray-400 text-sm mb-4">
              关键安全不变式：Provider 的种子在{" "}
              <strong className="text-white">任何用户请求之前</strong>已承诺，
              使得 Provider 无法针对特定用户的 userSeed 来选择有利的 providerSeed。
            </p>

            <PythFlowDiagram />

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { step: "1", title: "Provider 预承诺", desc: "在接受任何请求前，Provider 对其 seed 的哈希进行链上承诺", color: "text-blue-300" },
                { step: "2", title: "用户提交熵", desc: "用户发送 userSeed（任意随机 bytes32），无法被 Provider 预测", color: "text-yellow-300" },
                { step: "3", title: "VRF 回调", desc: "Provider 计算 VRF 输出并附证明，Entropy 合约验证后回调", color: "text-green-300" },
              ].map((s) => (
                <div key={s.step} className="bg-casino-card border border-casino-border rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold ${s.color} mb-1`}>{s.step}</div>
                  <div className="text-xs font-semibold text-white mb-1">{s.title}</div>
                  <div className="text-xs text-gray-500">{s.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="s1-3">
            <H2>安全属性证明</H2>

            <Callout type="proof" title="定理：1-of-2 诚实假设下的不可预测性">
              <p className="mb-2">
                在 SHA-256 随机预言机假设（ROM）和 ECDLP 困难假设下，只要 Provider 和 User 中至少一方诚实提供随机种子，
                <code className="bg-black/30 px-1 rounded">randomNumber</code> 对外部观察者在计算上不可预测。
              </p>
            </Callout>

            <MathBlock>{`证明（以 Provider 恶意为例）：

假设：恶意 Provider 尝试预测/控制 randomNumber

情况 A — Provider 恶意，User 诚实：
  User 生成：userSeed ← {0,1}^256 均匀随机
  Provider 已承诺 providerSeedHash = H(providerSeed)
  因此 providerSeed 在 userSeed 生成前已固定（无法针对性选择）

  randomNumber = H(providerSeed ⊕ userSeed)
  由于 userSeed 对 Provider 不可见且均匀随机：
  → randomNumber 在 {0,...,2^256-1} 上均匀分布
  → Provider 预测 randomNumber = SHA256 原像问题（困难）   ■

情况 B — User 恶意，Provider 诚实：
  Provider 已承诺 providerSeedHash，providerSeed 对 User 不可见
  User 无法通过穷举 userSeed 找到使 H(providerSeed⊕s) = 目标值的 s
  → 需要 2^128 次以上查询（生日攻击后仍不可行）               ■

情况 C — 双方均诚实：
  randomNumber 的熵 = H(providerEntropy) + H(userEntropy)
  ≥ 128 bits（任一方提供足够熵的前提下）                     ■`}</MathBlock>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {[
                { prop: "不可预测性", icon: "🎲", desc: "1-of-2 诚实假设下，输出无法被预测", strength: 9 },
                { prop: "可验证性", icon: "🔍", desc: "VRF 证明可链上验证，确保使用了承诺的种子", strength: 9 },
                { prop: "偏见抗性", icon: "⚖️", desc: "单方无法使输出偏向特定值", strength: 8 },
              ].map((p) => (
                <div key={p.prop} className="bg-casino-card border border-casino-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{p.icon}</span>
                    <span className="text-sm font-semibold text-white">{p.prop}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{p.desc}</p>
                  <div className="flex gap-0.5">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-sm ${i < p.strength ? "bg-green-500" : "bg-gray-700"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="s1-4">
            <H2>威胁模型分析</H2>

            <Callout type="success" title="Revert 攻击对 Pyth Entropy 完全无效">
              传统区块随机数中，攻击者可在同一交易内预览结果并 revert。
              Pyth Entropy 的随机数在<strong>独立的回调交易</strong>中产生，
              攻击者在请求交易中根本无法知道随机数是什么，revert 攻击无效。
            </Callout>

            <ThreatTable
              rows={[
                ["恶意 Provider", "控制 providerSeed 选择", "用户提供随机 userSeed，Provider 无法预知", "Provider 可拒绝回调（DoS）"],
                ["恶意 User", "控制 userSeed 选择", "Provider 已预承诺 seed，User 无法穷举", "无显著残余风险"],
                ["Revert-if-Unfavorable", "在同一 tx 中预测结果", "随机数在回调 tx 中产生，无法提前预知", "完全无效"],
                ["验证者操控区块", "选择有利 prevrandao", "随机数来自 Pyth 网络，不依赖区块变量", "完全无效"],
                ["重放攻击", "使用旧 sequenceNumber", "每次请求的 sequenceNumber 唯一绑定", "完全防御"],
                ["伪造回调", "冒充 Entropy 合约回调", "onlyEntropy 检查：msg.sender == entropy", "完全防御"],
              ]}
            />
          </Section>

          <Section id="s1-5">
            <H2>使用指南</H2>

            <Code language="solidity">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEntropy.sol";

contract MyGame is IEntropyConsumer {
    IEntropy public immutable entropy;
    address public immutable provider;

    // 游戏数据（在 VRF 请求前存储 — CEI 原则）
    mapping(uint64 => uint256) public seqToGameId;
    mapping(uint256 => Game)   public games;
    uint256 public gameCount;

    struct Game {
        address player;
        uint256 guess;
        uint256 betAmount;
        uint8   state; // 0=PENDING, 1=COMPLETED
        uint256 result;
        bool    won;
    }

    constructor(address _entropy, address _provider) payable {
        entropy  = IEntropy(_entropy);
        provider = _provider;
    }

    // ① 用户请求随机数
    function requestGame(uint256 guess, bytes32 userSeed)
        external payable returns (uint256 gameId)
    {
        uint128 fee = entropy.getFee(provider);
        require(msg.value >= fee + MIN_BET, "Insufficient value");

        // CEI: 先存储，再调用外部合约
        gameId = gameCount++;
        games[gameId] = Game(msg.sender, guess, msg.value - fee, 0, 0, false);

        // 请求 VRF（userSeed 增加用户侧熵）
        uint64 seqNum = entropy.requestWithCallback{value: fee}(
            provider,
            userSeed   // 任意 bytes32，越随机越好
        );
        seqToGameId[seqNum] = gameId;
    }

    // ② Pyth 异步回调（仅 Entropy 合约可调用）
    function entropyCallback(
        uint64 sequenceNumber,
        address, // provider（Entropy 合约已验证）
        bytes32 randomNumber
    ) external override {
        require(msg.sender == address(entropy), "Only Entropy");

        uint256 gameId = seqToGameId[sequenceNumber];
        Game storage g = games[gameId];
        require(g.state == 0, "Already processed");

        g.result = (uint256(randomNumber) % 6) + 1;
        g.won    = (g.result == g.guess);
        g.state  = 1;

        if (g.won) {
            uint256 payout = g.betAmount * WIN_MULTIPLIER;
            payable(g.player).transfer(payout);
        }
    }

    function getEntropy() external view override returns (address) {
        return address(entropy);
    }
}`}
            </Code>

            <Code language="typescript">{`// 前端：生成安全的 userSeed
import { ethers } from 'ethers';

// ✅ 正确：使用 CSPRNG
const userSeed = ethers.hexlify(ethers.randomBytes(32));

// ❌ 错误：Math.random() 不是密码学安全的
const badSeed = ethers.keccak256(ethers.toUtf8Bytes(Math.random().toString()));

// 发送请求（bet + entropy fee）
const fee   = await contract.getRequestFee();
const bet   = ethers.parseEther("0.01");
const total = bet + fee;

const tx = await contract.requestGame(guess, userSeed, { value: total });
const receipt = await tx.wait();

// 监听回调事件（异步）
contract.on("GameResolved", (gameId, player, guess, result, won) => {
    if (player === myAddress) {
        showResult(result, won);
    }
});`}
            </Code>
          </Section>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 2: Proof of Play vRNG                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Section id="s2">
          <H1>
            <span className="text-2xl">🌐</span>
            Proof of Play vRNG — 技术分析
            <span className="ml-auto text-sm font-normal text-green-400 bg-green-900/30 border border-green-500/30 px-3 py-1 rounded-full">
              安全评级：9/10
            </span>
          </H1>

          <Section id="s2-1">
            <H2>drand 协议原理</H2>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              drand（Distributed Randomness Beacon）是运行在 League of Entropy（LoE）多个机构间的
              <strong className="text-white">公开可验证随机数信标</strong>，每隔固定时间产生一个新的随机值。
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "不可预测", icon: "🎲", desc: "参与方无法提前知道未来随机数" },
                { label: "不可偏见", icon: "⚖️", desc: "参与方无法使输出偏向特定值" },
                { label: "公开可验证", icon: "🔍", desc: "任何人可验证，无需信任" },
                { label: "高可用", icon: "🔄", desc: "部分节点故障不影响产出" },
              ].map((p) => (
                <div key={p.label} className="bg-casino-card border border-casino-border rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className="text-sm font-semibold text-white mb-1">{p.label}</div>
                  <div className="text-xs text-gray-500">{p.desc}</div>
                </div>
              ))}
            </div>

            <DrandFlowDiagram />
          </Section>

          <Section id="s2-2">
            <H2>阈值 BLS 签名数学基础</H2>

            <MathBlock>{`椭圆曲线配对（BLS12-381）：
  定义双线性配对 e: G₁ × G₂ → Gₜ
  满足：e(aP, bQ) = e(P, Q)^{ab}  ∀ a,b ∈ Zₚ

BLS 签名方案：
  密钥生成：sk ← Zₚ，pk = sk · G₂

  签名：    σ = sk · H(msg)       // H: {0,1}* → G₁
  验证：    e(σ, G₂) = e(H(msg), pk)
            等价于 e(sk·H(msg), G₂) = e(H(msg), sk·G₂)  ✓

Shamir 秘密分享（t-of-n）：
  设置：选择随机多项式 f(x) = a₀ + a₁x + ... + a_{t-1}x^{t-1}
       其中 a₀ = sk（要保密的主私钥）
  分片：参与方 i 收到 skᵢ = f(i) mod p

  重建（给定 t 个分片）：
       sk = Σᵢ skᵢ · λᵢ   （Lagrange 插值系数 λᵢ 公开已知）

阈值签名（每轮 drand 随机数生成）：
  消息：  msg_n = H(round_n)  （unchained 模式）
  部分：  σᵢ = skᵢ · H(msg)   （各参与方独立计算）
  聚合：  σ = Σ λᵢ · σᵢ       （任意 t 个分片即可聚合）
  输出：  randomness_n = SHA256(σ)
  验证：  e(σ, G₂) = e(H(msg), pk)  （任何人可验证）`}</MathBlock>
          </Section>

          <Section id="s2-3">
            <H2>League of Entropy 组成</H2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                { name: "Protocol Labs", type: "区块链研究", country: "🇺🇸" },
                { name: "Cloudflare", type: "云计算/CDN", country: "🇺🇸" },
                { name: "EPFL", type: "学术研究", country: "🇨🇭" },
                { name: "Kudelski Security", type: "网络安全", country: "🇨🇭" },
                { name: "U. of Chile", type: "学术研究", country: "🇨🇱" },
                { name: "QRL Foundation", type: "量子安全", country: "🇬🇧" },
                { name: "C4DT", type: "数字信任", country: "🇨🇭" },
                { name: "Ethereum Foundation", type: "区块链研究", country: "🌍" },
              ].map((org) => (
                <div key={org.name} className="bg-casino-card border border-casino-border rounded-lg p-2 text-xs">
                  <div className="flex items-center gap-1 mb-1">
                    <span>{org.country}</span>
                    <span className="font-semibold text-white truncate">{org.name}</span>
                  </div>
                  <div className="text-gray-500">{org.type}</div>
                </div>
              ))}
            </div>

            <Callout type="info" title="机构多样性的安全意义">
              LoE 成员横跨不同<strong>国家</strong>（美国、瑞士、智利、英国等）、
              不同<strong>类型</strong>（学术、商业、非营利）、不同<strong>利益关系</strong>。
              这保证了没有单一实体可以在不暴露的情况下悄悄影响足够多的机构，
              合谋的法律风险和声誉风险极高。drand 已持续运行多年，未发生安全事件。
            </Callout>
          </Section>

          <Section id="s2-4">
            <H2>安全属性证明</H2>

            <Callout type="proof" title="定理：t-of-n 阈值下的不可预测性">
              假设 ECDLP 在 BLS12-381 困难，BLS 满足 EUF-CMA 安全性。
              当被攻破节点数 f {"<"} t 时，对手无法预测下一轮 drand 输出。
            </Callout>

            <MathBlock>{`证明框架：

假设攻击者 A 可以预测 randomness_n = SHA256(σ_n)

A 必须能预测 σ_n（SHA256 单向性 → 需先知道 σ_n）

σ_n 是聚合 BLS 签名（私钥 sk 对 msg_n 的签名）
msg_n = H(round_n) 是公开已知的

若 A 能伪造 σ_n：
  → A 打破了 BLS 签名的 EUF-CMA 安全性     (矛盾假设)

若 A 通过获取分片重建 sk：
  → A 需要攻破 ≥ t 个独立节点
  → 假设 f < t 个节点被攻破                 (矛盾条件)

∴ 在 f < t 的假设下，A 无法预测 randomness_n  □

不可偏见性（Bias-Resistance）：
  恶意节点可以修改其 σᵢ（部分签名），但：
  - BLS 的代数结构：σ = Σ λᵢ · σᵢ
  - 修改 σᵢ 改变了 σ，但 A 无法控制 SHA256(σ) 的值
  - 等价于在不知道 SHA256 原像的情况下定向碰撞    □`}</MathBlock>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {[
                { prop: "不可预测性", strength: 9, desc: "t-of-n 协同才能生成有效签名，单方无法预测", color: "bg-green-500" },
                { prop: "公开可验证性", strength: 10, desc: "BLS 签名可在 BLS12-381 上链下/链上验证，完全透明", color: "bg-green-500" },
                { prop: "偏见抗性", strength: 9, desc: "BLS 代数结构使得定向操控哈希输出计算不可行", color: "bg-green-500" },
              ].map((p) => (
                <div key={p.prop} className="bg-casino-card border border-casino-border rounded-xl p-3">
                  <div className="text-sm font-semibold text-white mb-1">{p.prop}</div>
                  <p className="text-xs text-gray-500 mb-2">{p.desc}</p>
                  <div className="flex gap-0.5">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`h-1.5 flex-1 rounded-sm ${i < p.strength ? p.color : "bg-gray-700"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="s2-5">
            <H2>威胁模型分析</H2>

            <ThreatTable
              rows={[
                ["LoE 机构合谋", "控制 ≥ t 个 LoE 机构", "机构多样性（跨国、跨类型）；合谋代价极高", "极低（需 8+ 机构同谋）"],
                ["PoP 服务不诚实", "替换或选择 drand 输出", "无法伪造 BLS 签名；链上验证可检测", "拒绝服务（不回调）"],
                ["拒绝服务", "使 ≥ n-t 节点离线", "全球分布式基础设施；多 CDN 节点", "极低"],
                ["重放攻击", "使用旧轮次随机数", "requestId/traceId 唯一绑定每次请求", "完全防御"],
                ["Revert 攻击", "同一 tx 中预测 drand 输出", "随机数在回调 tx 中传入，请求时未知", "完全无效"],
                ["时间预测", "预测未来 drand 输出", "未来签名依赖当前未出现的部分签名聚合", "计算不可行"],
              ]}
            />

            <Callout type="warning" title="关于 PoP 服务中间层的额外信任说明">
              Proof of Play vRNG 在 drand 和您的合约之间充当中间层，引入了一个信任假设：
              PoP 服务传递了正确的 drand 输出。PoP <strong>无法伪造</strong>随机数（BLS 签名不可伪造），
              但理论上可以拒绝传递（DoS）。对于最高安全需求，可以在合约中直接验证 drand 的 BLS 签名
              （约消耗 500K gas 用于 BLS12-381 配对运算，或等待 EVM 添加 BLS 预编译后大幅降低成本）。
            </Callout>
          </Section>

          <Section id="s2-6">
            <H2>使用指南</H2>

            <Code language="solidity">{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IProofOfPlayVRNG.sol";

contract MyGame is IVRNGConsumer {
    // HyperEVM 主网 PoP vRNG 合约（已部署）
    address constant POP_VRNG = 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1;

    IProofOfPlayVRNG public immutable vrng;
    address public immutable callbackSender; // PoP 授权的回调发送方

    mapping(uint256 => uint256) public requestToGame;
    mapping(uint256 => uint256) public traceToGame;
    mapping(uint256 => Game)   public games;
    uint256 public gameCount;
    uint256 public traceCounter;

    struct Game {
        address player;
        uint256 guess;
        uint256 betAmount;
        uint8   state;
        uint256 result;
        bool    won;
    }

    constructor(address _callbackSender) payable {
        vrng           = IProofOfPlayVRNG(POP_VRNG);
        callbackSender = _callbackSender;
    }

    // ① 用户请求随机数
    function requestGame(uint256 guess)
        external payable returns (uint256 gameId)
    {
        uint256 traceId = ++traceCounter;

        // CEI: 先存储再请求
        gameId = gameCount++;
        games[gameId] = Game(msg.sender, guess, msg.value, 0, 0, false);
        traceToGame[traceId] = gameId;

        // 请求 drand 随机数
        uint256 requestId = vrng.requestRandomNumberWithTraceId(traceId);
        requestToGame[requestId] = gameId;
    }

    // ② PoP 异步回调（仅授权地址可调用）
    function receiveRandomNumber(
        uint256 requestId,
        uint256 randomNumber // 来自 drand，可链下验证 BLS 签名
    ) external override {
        require(msg.sender == callbackSender, "Only vRNG");

        uint256 gameId = requestToGame[requestId];
        Game storage g = games[gameId];
        require(g.state == 0, "Already processed");

        g.result = (randomNumber % 6) + 1;
        g.won    = (g.result == g.guess);
        g.state  = 1;

        if (g.won) {
            payable(g.player).transfer(g.betAmount * WIN_MULTIPLIER);
        }
    }
}`}
            </Code>
          </Section>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 3: 方案对比                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Section id="s3">
          <H1>
            <span className="text-2xl">⚡</span>
            方案对比与选择建议
          </H1>

          <H2>技术维度对比</H2>
          <CompareTable />

          <H2>选择决策树</H2>
          <div className="bg-casino-card border border-casino-border rounded-xl p-5 font-mono text-xs">
            <div className="space-y-2 text-gray-300">
              <div>我需要在 HyperEVM 上使用安全随机数：</div>
              <div className="ml-4">├── 需要快速上线，不想申请白名单？</div>
              <div className="ml-8 text-green-300">│   └── ✅ 选择 Pyth Entropy（即插即用）</div>
              <div className="ml-4">├── 需要最高去中心化程度？</div>
              <div className="ml-8 text-green-300">│   └── ✅ 选择 Proof of Play vRNG（drand LoE）</div>
              <div className="ml-4">├── 需要极高安全性（大额赌注）？</div>
              <div className="ml-8 text-blue-300">│   └── ✅ 两者结合：result = Pyth XOR drand</div>
              <div className="ml-4">└── 只是快速原型/测试？</div>
              <div className="ml-8 text-yellow-300">    └── ⚠️ Commit-Reveal 可接受，上线前必须切换</div>
            </div>
          </div>

          <H2>双 VRF 组合（最高安全）</H2>
          <Callout type="info" title="组合安全定理">
            若 Pyth Entropy 和 drand 相互独立（不共享密钥或基础设施），则{" "}
            <code className="bg-black/30 px-1 rounded">combined = keccak256(pythOutput, drandOutput)</code>{" "}
            的安全性等于两者中较安全的那个。即使其中一个被攻破，只要另一个安全，结果就安全。
          </Callout>

          <Code language="solidity">{`// 双 VRF 组合合约（极高安全）
contract UltraSecureDice is IEntropyConsumer, IVRNGConsumer {
    struct PendingGame {
        address player;
        uint256 guess;
        uint256 betAmount;
        bytes32 pythOutput;  // Pyth 的 VRF 输出
        uint256 drandOutput; // drand 的输出
        bool    hasPyth;
        bool    hasDrand;
    }

    mapping(uint64  => uint256) public seqToGame;
    mapping(uint256 => uint256) public reqToGame;
    mapping(uint256 => PendingGame) public pending;
    uint256 public gameCount;

    function _finalize(uint256 gameId) internal {
        PendingGame storage p = pending[gameId];
        if (!p.hasPyth || !p.hasDrand) return; // 等待两方都到达

        // 组合两个独立来源
        uint256 combined = uint256(keccak256(
            abi.encodePacked(p.pythOutput, p.drandOutput)
        ));
        uint256 result = (combined % 6) + 1;
        bool won = (result == p.guess);

        // 支付逻辑...
        delete pending[gameId];
    }

    function entropyCallback(uint64 seq, address, bytes32 rn) external {
        require(msg.sender == address(entropy));
        uint256 gameId = seqToGame[seq];
        pending[gameId].pythOutput = rn;
        pending[gameId].hasPyth = true;
        _finalize(gameId);
    }

    function receiveRandomNumber(uint256 reqId, uint256 rn) external {
        require(msg.sender == callbackSender);
        uint256 gameId = reqToGame[reqId];
        pending[gameId].drandOutput = rn;
        pending[gameId].hasDrand = true;
        _finalize(gameId);
    }
}`}
          </Code>
        </Section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  SECTION 4: 检查清单                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <Section id="s4">
          <H1>
            <span className="text-2xl">✅</span>
            集成安全检查清单
          </H1>

          <p className="text-gray-400 text-sm mb-6">
            点击条目进行勾选，追踪集成进度。
          </p>

          <ChecklistGroup
            title="🔐 合约安全"
            items={[
              "遵循 CEI 原则：先存储游戏数据，再调用 VRF 合约（防止重入）",
              "onlyEntropy / onlyVRNG 修饰符保护回调函数，防止伪造回调",
              "回调未到达时的超时退款机制（Commit-Reveal 有；Pyth/PoP 需自行实现）",
              "游戏状态机：PENDING → COMPLETED，防止同一游戏被重复处理",
              "锁定可能的赔付金额：回调前从 houseBalance 中预扣 MAX_PAYOUT",
              "使用 ReentrancyGuard 或 CEI 模式防止重入攻击",
              "设置最大单笔赌注上限（防止单次大额攻击影响整个庄家资金）",
              "实现紧急暂停功能（Pausable），异常时可快速暂停",
            ]}
          />

          <ChecklistGroup
            title="💻 前端安全"
            items={[
              "用户种子使用 crypto.getRandomValues()，不使用 Math.random()",
              "向用户显示用户种子哈希，允许独立验证公平性",
              "使用事件监听（而非轮询）获取 VRF 回调结果，更可靠",
              "处理 VRF 回调超时的 UI 状态，避免用户卡在加载中",
              "向用户展示 VRF 证明的链接或哈希，提升透明度",
            ]}
          />

          <ChecklistGroup
            title="📡 运营安全"
            items={[
              "监控 VRF 回调平均延迟，超过阈值发出告警",
              "保留完整的游戏日志（请求 hash、VRF 输出、结果）用于争议仲裁",
              "定期（每周/每月）验证 Pyth/PoP 合约地址未被替换",
              "设置庄家资金预警：当余额低于 MAX_PAYOUT × 10 时告警",
              "为 Commit-Reveal 方案设置服务器端自动揭示，避免超时退款",
            ]}
          />

          <ChecklistGroup
            title="💰 经济安全"
            items={[
              "赔率设计留有 1-5% 的庄家优势（数学期望为正）",
              "维护足够的庄家资金：houseBalance ≥ MAX_PAYOUT × 最大并发游戏数",
              "考虑限制每个地址的并发游戏数量，防止策略性攻击",
              "评估 Pyth entropy fee 对小额赌注的影响（fee 可能高于 bet）",
              "为极端情况设置庄家最大亏损上限（熔断机制）",
            ]}
          />
        </Section>

        {/* Bottom spacer */}
        <div className="h-32" />
      </main>
    </div>
  );
}
