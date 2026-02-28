import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { BLOCK_RANDOMNESS_ABI } from "../contracts/abis";
import { DiceDisplay, GuessPicker, RollResultBadge } from "./DiceDisplay";
import { RollResult } from "../types";

interface Props {
  contractAddress: string;
  signer: ethers.JsonRpcSigner | null;
  onRefreshBalance: () => void;
}

export function BlockRandomnessDemo({ contractAddress, signer, onRefreshBalance }: Props) {
  const [guess, setGuess] = useState(1);
  const [betEth, setBetEth] = useState("0.01");
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [showAttack, setShowAttack] = useState(false);
  const [attackRunning, setAttackRunning] = useState(false);
  const [attackLog, setAttackLog] = useState<string[]>([]);

  const roll = useCallback(async () => {
    if (!signer || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      alert("请先部署合约并连接钱包（运行 make deploy）");
      return;
    }

    setRolling(true);
    const entry: RollResult = {
      guess,
      betAmount: ethers.parseEther(betEth),
      state: "submitting",
      timestamp: Date.now(),
      randomSource: "block.prevrandao + block.timestamp + msg.sender",
    };
    setLastResult(entry);

    try {
      const contract = new ethers.Contract(contractAddress, BLOCK_RANDOMNESS_ABI, signer);
      const tx = await contract.roll(guess, { value: ethers.parseEther(betEth) });
      entry.txHash = tx.hash;
      entry.state = "pending";
      setLastResult({ ...entry });

      const receipt = await tx.wait();

      // Parse DiceRolled event
      const event = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "DiceRolled");

      if (event) {
        const result = Number(event.args.result);
        const won = event.args.won as boolean;
        entry.result = result;
        entry.won = won;
        entry.payout = won ? entry.betAmount * 5n : 0n;
        entry.state = "completed";
        setLastResult({ ...entry });
        setHistory((h) => [{ ...entry }, ...h].slice(0, 20));
      }

      onRefreshBalance();
    } catch (err: unknown) {
      entry.state = "error";
      entry.errorMsg = err instanceof Error ? err.message : "Transaction failed";
      setLastResult({ ...entry });
    }

    setRolling(false);
  }, [signer, contractAddress, guess, betEth, onRefreshBalance]);

  const simulateAttack = useCallback(async () => {
    if (!signer || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      alert("请先部署合约并连接钱包");
      return;
    }

    setAttackRunning(true);
    setAttackLog([]);

    const contract = new ethers.Contract(contractAddress, BLOCK_RANDOMNESS_ABI, signer);
    const log: string[] = [];

    log.push("🔍 攻击者开始探测当前区块的随机数...");
    setAttackLog([...log]);

    for (let attempt = 1; attempt <= 6; attempt++) {
      for (let g = 1; g <= 6; g++) {
        try {
          const [result, wouldWin] = await contract.rollView(g);
          log.push(`  猜测 ${g} → 预测结果: ${result}，${wouldWin ? "✅ 会赢!" : "❌ 会输"}`);
          setAttackLog([...log]);

          if (wouldWin) {
            log.push(`\n⚡ 攻击者发现有利结果！提交猜测 ${g}...`);
            setAttackLog([...log]);
            const tx = await contract.roll(g, { value: ethers.parseEther("0.001") });
            await tx.wait();
            log.push(`✅ 攻击成功！交易: ${tx.hash.slice(0, 12)}...`);
            setAttackLog([...log]);
            setAttackRunning(false);
            return;
          }
        } catch {
          log.push(`  跳过猜测 ${g}（调用失败）`);
        }
      }
      log.push(`\n尝试 ${attempt}/6：切换区块重试...`);
      setAttackLog([...log]);
      // In reality would wait for next block, here we just show the concept
      break;
    }

    log.push("\n⚠️ 注意：真实攻击场景中，攻击者合约会自动 revert 不利交易，无成本地重试");
    setAttackLog([...log]);
    setAttackRunning(false);
  }, [signer, contractAddress]);

  const isDeployed = contractAddress !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="space-y-6">
      {/* Security warning */}
      <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <div className="font-bold text-red-300 mb-1">安全警告：此方法不可用于生产环境</div>
            <div className="text-sm text-red-200/70">
              在 HyperEVM 上，区块变量可被验证者和攻击者合约操控。
              此演示仅用于展示{" "}
              <strong className="text-red-300">为什么这是危险的</strong>。
            </div>
          </div>
        </div>
      </div>

      {!isDeployed && (
        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4 text-yellow-300 text-sm">
          ⚠️ 合约尚未部署。请运行 <code className="bg-black/40 px-1 rounded">make deploy</code>{" "}
          后刷新页面。
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game panel */}
        <div className="bg-casino-card border border-casino-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">骰子游戏</h3>

          <div className="flex flex-col items-center gap-6">
            <DiceDisplay result={lastResult?.result} rolling={rolling} size="lg" />

            <div>
              <div className="text-sm text-gray-400 mb-2">选择你的猜测</div>
              <GuessPicker value={guess} onChange={setGuess} disabled={rolling || !isDeployed} />
            </div>

            <div className="w-full">
              <label className="text-sm text-gray-400">押注金额 (HYPE)</label>
              <input
                type="number"
                value={betEth}
                onChange={(e) => setBetEth(e.target.value)}
                min="0.001"
                max="1"
                step="0.001"
                disabled={rolling || !isDeployed}
                className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 disabled:opacity-50"
              />
            </div>

            <button
              onClick={roll}
              disabled={rolling || !signer || !isDeployed}
              className="w-full py-3 rounded-xl font-bold text-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
            >
              {rolling ? "骰子滚动中..." : "🎲 掷骰子（不安全）"}
            </button>

            {lastResult?.state === "completed" && lastResult.result && (
              <RollResultBadge
                won={lastResult.won ?? false}
                guess={lastResult.guess}
                result={lastResult.result}
                bet={lastResult.betAmount}
                payout={lastResult.payout}
              />
            )}

            {lastResult?.state === "error" && (
              <div className="w-full p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-sm">
                错误: {lastResult.errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Technical details */}
        <div className="space-y-4">
          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">随机数生成代码</h3>
            <pre className="text-xs text-green-300 font-mono overflow-x-auto bg-black/50 rounded p-3">
{`// ⚠️ 危险！勿在生产使用
function _insecureRandom()
  internal view returns (uint256) {
  return (uint256(keccak256(
    abi.encodePacked(
      block.prevrandao,  // ⚠️ 可被验证者控制
      block.timestamp,   // ⚠️ 可被提议者调整
      block.number,      // ⚠️ 完全可预测
      msg.sender         // ⚠️ 攻击者控制
    )
  )) % 6) + 1;
}`}
            </pre>
          </div>

          {/* Attack simulator */}
          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-400">攻击模拟器</h3>
              <button
                onClick={() => setShowAttack(!showAttack)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {showAttack ? "收起" : "展开"}
              </button>
            </div>

            {showAttack && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  演示攻击者如何预览结果并只提交有利的交易
                </p>
                <button
                  onClick={simulateAttack}
                  disabled={attackRunning || !signer || !isDeployed}
                  className="w-full py-2 rounded-lg text-sm bg-red-900/50 hover:bg-red-900 border border-red-500/30 text-red-300 disabled:opacity-50 transition-all"
                >
                  {attackRunning ? "模拟攻击中..." : "⚡ 模拟攻击"}
                </button>
                {attackLog.length > 0 && (
                  <div className="bg-black/50 rounded p-3 max-h-40 overflow-y-auto">
                    {attackLog.map((line, i) => (
                      <div key={i} className="text-xs font-mono text-gray-300">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Roll history */}
          {history.length > 0 && (
            <div className="bg-casino-card border border-casino-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">历史记录</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((r, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center text-xs p-2 rounded ${
                      r.won
                        ? "bg-green-900/20 text-green-300"
                        : "bg-red-900/20 text-red-300"
                    }`}
                  >
                    <span>
                      猜 {r.guess} → 结果 {r.result}
                    </span>
                    <span>{r.won ? "赢" : "输"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
