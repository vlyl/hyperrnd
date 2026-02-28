import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { PYTH_ENTROPY_ABI } from "../contracts/abis";
import { DiceDisplay, GuessPicker, RollResultBadge } from "./DiceDisplay";
import { RollResult } from "../types";

interface Props {
  contractAddress: string;
  signer: ethers.JsonRpcSigner | null;
  provider: ethers.BrowserProvider | null;
  onRefreshBalance: () => void;
}

export function PythEntropyDemo({ contractAddress, signer, provider, onRefreshBalance }: Props) {
  const [guess, setGuess] = useState(1);
  const [betEth, setBetEth] = useState("0.01");
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [entropyFee, setEntropyFee] = useState<bigint | null>(null);

  const isDeployed = contractAddress !== "0x0000000000000000000000000000000000000000";

  // Fetch entropy fee
  useEffect(() => {
    if (!provider || !isDeployed) return;
    const fetchFee = async () => {
      try {
        const contract = new ethers.Contract(contractAddress, PYTH_ENTROPY_ABI, provider);
        const fee = await contract.getRequestFee();
        setEntropyFee(fee as bigint);
      } catch {
        // Ignore
      }
    };
    fetchFee();
  }, [provider, contractAddress, isDeployed]);

  const requestRoll = useCallback(async () => {
    if (!signer || !isDeployed) {
      alert("请先部署合约并连接钱包");
      return;
    }

    setRolling(true);
    const entry: RollResult = {
      guess,
      betAmount: ethers.parseEther(betEth),
      state: "submitting",
      timestamp: Date.now(),
      randomSource: "Pyth Entropy VRF",
    };
    setLastResult(entry);
    setStatusMsg("生成用户随机种子...");

    try {
      const contract = new ethers.Contract(contractAddress, PYTH_ENTROPY_ABI, signer);

      // Get fee
      const fee = entropyFee ?? (await contract.getRequestFee() as bigint);
      const betAmount = ethers.parseEther(betEth);
      const totalValue = betAmount + fee;

      // Generate user seed (adds user-side entropy)
      const userSeed = ethers.hexlify(ethers.randomBytes(32));
      setStatusMsg("发送随机数请求到 Pyth Entropy...");

      const tx = await contract.requestRoll(guess, userSeed, { value: totalValue });
      entry.txHash = tx.hash;
      entry.state = "pending";
      setLastResult({ ...entry });
      setStatusMsg(`等待 Pyth 回调... ${tx.hash.slice(0, 12)}...`);

      const receipt = await tx.wait();

      // Check if GameResolved event is in the receipt (local mock auto-fulfills)
      const resolvedEvent = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "GameResolved");

      if (resolvedEvent) {
        // Immediate resolution (local mock)
        const result = Number(resolvedEvent.args.result);
        const won = resolvedEvent.args.won as boolean;
        entry.result = result;
        entry.won = won;
        entry.payout = won ? betAmount * 5n : 0n;
        entry.state = "completed";
        setStatusMsg(won ? "🎉 Pyth 已回调，赢了！" : "✅ Pyth 已回调，输了。");
      } else {
        // Async resolution — poll for game state
        setStatusMsg("等待 Pyth 异步回调...");
        const gameId = await contract.gameCount() - 1n;
        entry.gameId = gameId;

        // Poll for resolution (up to 30s)
        let resolved = false;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const game = await contract.getGame(gameId);
          if (Number(game.state) === 1) { // COMPLETED
            entry.result = Number(game.result);
            entry.won = game.won as boolean;
            entry.payout = entry.won ? betAmount * 5n : 0n;
            entry.state = "completed";
            resolved = true;
            setStatusMsg(entry.won ? "🎉 Pyth 回调，赢了！" : "✅ Pyth 回调，输了。");
            break;
          }
        }

        if (!resolved) {
          setStatusMsg("⏰ 等待超时，请稍后查看游戏结果。");
          entry.state = "error";
          entry.errorMsg = "VRF 回调超时（这在测试网可能正常）";
        }
      }

      setLastResult({ ...entry });
      if (entry.state === "completed") {
        setHistory((h) => [{ ...entry }, ...h].slice(0, 20));
      }
      onRefreshBalance();
    } catch (err: unknown) {
      entry.state = "error";
      entry.errorMsg = err instanceof Error ? err.message : "Transaction failed";
      setLastResult({ ...entry });
      setStatusMsg("发生错误");
    }

    setRolling(false);
  }, [signer, contractAddress, guess, betEth, entropyFee, isDeployed, onRefreshBalance]);

  return (
    <div className="space-y-6">
      <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🟢</span>
          <div>
            <div className="font-bold text-green-300 mb-1">安全：Pyth Entropy VRF</div>
            <div className="text-sm text-green-200/70">
              Pyth 网络提供可验证随机函数。用户和提供商各自提供熵，
              无论哪方都无法单独控制结果。在本地使用 MockEntropy 模拟。
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
                disabled={rolling}
                className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500 disabled:opacity-50"
              />
              {entropyFee !== null && (
                <div className="text-xs text-gray-500 mt-1">
                  + Pyth 手续费: {ethers.formatEther(entropyFee)} HYPE
                </div>
              )}
            </div>

            <button
              onClick={requestRoll}
              disabled={rolling || !signer || !isDeployed}
              className="w-full py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-all text-white"
            >
              {rolling ? "等待 VRF 回调..." : "🎲 请求随机数（Pyth VRF）"}
            </button>

            {statusMsg && (
              <div className="w-full text-sm p-3 bg-gray-800 rounded-lg text-gray-300 text-center">
                {statusMsg}
              </div>
            )}

            {lastResult?.state === "completed" && lastResult.result !== undefined && (
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
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Pyth Entropy 工作原理</h3>
            <pre className="text-xs text-green-300 font-mono overflow-x-auto bg-black/50 rounded p-3">
{`// 1. 获取手续费
fee = entropy.getFee(provider)

// 2. 用户请求（提供用户熵）
seqNum = entropy.requestWithCallback{
  value: fee
}(provider, userSeed)
// Pyth 的种子在链下预先承诺

// 3. Pyth 回调（异步）
function entropyCallback(
  seqNum, provider, randomNumber
) {
  // randomNumber = VRF(providerSeed, userSeed)
  // 双方均无法单独预测此值
  result = (uint256(randomNumber) % 6) + 1
}`}
            </pre>
          </div>

          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">VRF 安全属性</h3>
            <ul className="text-xs text-gray-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                用户种子：在提交前随机生成，无法被预测
              </li>
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                Pyth 种子：在用户请求前已在链下承诺
              </li>
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                组合熵：hash(userSeed XOR providerSeed)
              </li>
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                任何人可以验证 VRF 证明的正确性
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400">ℹ️</span>
                本地：MockEntropy 即时回调（生产：Pyth 异步回调）
              </li>
            </ul>
          </div>

          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">部署信息</h3>
            <div className="text-xs text-gray-500 space-y-1">
              <div>HyperEVM Mainnet: 查询 entropy-explorer.pyth.network (Chain 999)</div>
              <div>本地测试: MockEntropy 合约</div>
              <div>Pyth 提供商: 可自定义（不同安全级别）</div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="bg-casino-card border border-casino-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">历史记录</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((r, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center text-xs p-2 rounded ${
                      r.won ? "bg-green-900/20 text-green-300" : "bg-red-900/20 text-red-300"
                    }`}
                  >
                    <span>猜 {r.guess} → 结果 {r.result}</span>
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
