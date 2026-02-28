import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { PROOF_OF_PLAY_ABI, MOCK_VRNG_ABI } from "../contracts/abis";
import { DiceDisplay, GuessPicker, RollResultBadge } from "./DiceDisplay";
import { RollResult } from "../types";

interface Props {
  contractAddress: string;
  mockVRNGAddress?: string;
  signer: ethers.JsonRpcSigner | null;
  provider: ethers.BrowserProvider | null;
  onRefreshBalance: () => void;
}

export function ProofOfPlayDemo({ contractAddress, mockVRNGAddress, signer, provider, onRefreshBalance }: Props) {
  const [guess, setGuess] = useState(1);
  const [betEth, setBetEth] = useState("0.01");
  const [rolling, setRolling] = useState(false);
  const [pendingGameId, setPendingGameId] = useState<bigint | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<bigint | null>(null);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const isDeployed = contractAddress !== "0x0000000000000000000000000000000000000000";
  const isMock = !!mockVRNGAddress && mockVRNGAddress !== "0x0000000000000000000000000000000000000000";

  const requestRoll = useCallback(async () => {
    if (!signer || !isDeployed) {
      alert("请先部署合约并连接钱包");
      return;
    }

    setRolling(true);
    const betAmount = ethers.parseEther(betEth);
    const entry: RollResult = {
      guess,
      betAmount,
      state: "submitting",
      timestamp: Date.now(),
      randomSource: "drand (League of Entropy)",
    };
    setLastResult(entry);
    setStatusMsg("发送 VRF 请求到 Proof of Play...");

    try {
      const contract = new ethers.Contract(contractAddress, PROOF_OF_PLAY_ABI, signer);

      const tx = await contract.requestRoll(guess, { value: betAmount });
      entry.txHash = tx.hash;
      entry.state = "pending";
      setLastResult({ ...entry });
      setStatusMsg(`等待 drand 随机数... ${tx.hash.slice(0, 12)}...`);

      const receipt = await tx.wait();

      // Check for GameResolved (local mock) or GameRequested (production)
      const resolvedEvent = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "GameResolved");

      const requestedEvent = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "GameRequested");

      if (resolvedEvent) {
        // Mock auto-fulfilled
        const result = Number(resolvedEvent.args.result);
        const won = resolvedEvent.args.won as boolean;
        entry.result = result;
        entry.won = won;
        entry.payout = won ? betAmount * 5n : 0n;
        entry.state = "completed";
        setStatusMsg(won ? "🎉 drand 已回调，赢了！" : "✅ drand 已回调，输了。");
        setLastResult({ ...entry });
        setHistory((h) => [{ ...entry }, ...h].slice(0, 20));
        onRefreshBalance();
      } else if (requestedEvent) {
        // Production: wait for async callback
        const gameId = requestedEvent.args.gameId as bigint;
        const requestId = requestedEvent.args.requestId as bigint;
        entry.gameId = gameId;
        setPendingGameId(gameId);
        setPendingRequestId(requestId);
        setLastResult({ ...entry });

        if (isMock && mockVRNGAddress) {
          // For mock: manually trigger fulfillment
          setStatusMsg("本地模式：手动触发 VRF 回调...");
          const mockContract = new ethers.Contract(mockVRNGAddress, MOCK_VRNG_ABI, signer);
          const fulfillTx = await mockContract.fulfillRequest(requestId);
          await fulfillTx.wait();
        } else {
          setStatusMsg("等待 Proof of Play drand 服务回调（生产环境约 1-3 秒）...");
        }

        // Poll for result
        let resolved = false;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          if (!provider) break;
          const readContract = new ethers.Contract(contractAddress, PROOF_OF_PLAY_ABI, provider);
          const game = await readContract.getGame(gameId);
          if (Number(game.state) === 1) { // COMPLETED
            entry.result = Number(game.result);
            entry.won = game.won as boolean;
            entry.payout = entry.won ? betAmount * 5n : 0n;
            entry.state = "completed";
            resolved = true;
            setPendingGameId(null);
            setPendingRequestId(null);
            setStatusMsg(entry.won ? "🎉 drand 回调，赢了！" : "✅ drand 回调，输了。");
            break;
          }
        }

        setLastResult({ ...entry });
        if (resolved && entry.state === "completed") {
          setHistory((h) => [{ ...entry }, ...h].slice(0, 20));
          onRefreshBalance();
        } else if (!resolved) {
          setStatusMsg("⏰ 等待超时");
          entry.state = "error";
          entry.errorMsg = "VRF 回调超时";
          setLastResult({ ...entry });
        }
      }
    } catch (err: unknown) {
      entry.state = "error";
      entry.errorMsg = err instanceof Error ? err.message : "Transaction failed";
      setLastResult({ ...entry });
      setStatusMsg("发生错误");
    }

    setRolling(false);
  }, [signer, contractAddress, mockVRNGAddress, provider, guess, betEth, isMock, isDeployed, onRefreshBalance]);

  const triggerFulfill = useCallback(async () => {
    if (!signer || !mockVRNGAddress || pendingRequestId === null) return;
    setStatusMsg("手动触发 VRF 回调...");
    try {
      const mockContract = new ethers.Contract(mockVRNGAddress, MOCK_VRNG_ABI, signer);
      const tx = await mockContract.fulfillRequest(pendingRequestId);
      await tx.wait();
      setStatusMsg("✅ 回调已触发，结果正在处理...");
    } catch (err: unknown) {
      setStatusMsg("触发失败: " + (err instanceof Error ? err.message : "unknown"));
    }
  }, [signer, mockVRNGAddress, pendingRequestId]);

  return (
    <div className="space-y-6">
      <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🟢</span>
          <div>
            <div className="font-bold text-green-300 mb-1">安全：Proof of Play vRNG（drand）</div>
            <div className="text-sm text-green-200/70">
              基于 drand（League of Entropy）的分布式随机数。由 16+ 个独立机构的阈值 BLS 签名提供支持，
              单一方无法操控结果。
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

      {isMock && (
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-3 text-blue-300 text-xs">
          ℹ️ 本地模式：使用 MockProofOfPlayVRNG，模拟 drand 回调（生产环境使用真实 drand 服务）
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
            </div>

            <button
              onClick={requestRoll}
              disabled={rolling || !signer || !isDeployed}
              className="w-full py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-all text-white"
            >
              {rolling ? "等待 drand..." : "🎲 请求 drand 随机数"}
            </button>

            {pendingGameId !== null && isMock && (
              <button
                onClick={triggerFulfill}
                className="w-full py-2 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white"
              >
                🔔 手动触发 VRF 回调（仅本地 Mock）
              </button>
            )}

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
            <h3 className="text-sm font-semibold text-gray-400 mb-3">drand 工作原理</h3>
            <pre className="text-xs text-green-300 font-mono overflow-x-auto bg-black/50 rounded p-3">
{`// 1. 合约请求随机数
requestId = vrng.requestRandomNumberWithTraceId(
  traceId
)

// 2. PoP vRNG 服务从 drand 获取
//    drand = 阈值 BLS 签名
//    需要 t-of-n 机构签名（t > 1/3）
//    每个 beacon 轮次产生新随机数

// 3. PoP 回调合约
function receiveRandomNumber(
  requestId,
  randomNumber  // 来自 drand
) {
  result = (randomNumber % 6) + 1
}`}
            </pre>
          </div>

          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">drand 安全机构</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              {["Protocol Labs", "Cloudflare", "EPFL (瑞士联邦理工)", "Kudelski Security",
                "Universidad de Chile", "QRL Foundation", "C4DT", "Randamu"].map((org) => (
                <div key={org} className="flex items-center gap-1">
                  <span className="text-green-400">•</span>
                  {org}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              + 更多机构。阈值：需要 1/3+ 以上联合作弊才能操控
            </div>
          </div>

          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">HyperEVM 部署</h3>
            <div className="text-xs text-gray-500 space-y-1">
              <div className="font-mono">PoP vRNG: 0x9eC728Fce50c77e0BeF7d34F1ab28a46409b7aF1</div>
              <div className="text-yellow-400">⚠️ 需向 Proof of Play 申请白名单注册</div>
              <div>本地测试: MockProofOfPlayVRNG</div>
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
