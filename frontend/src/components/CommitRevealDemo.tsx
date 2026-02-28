import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { COMMIT_REVEAL_ABI } from "../contracts/abis";
import { DiceDisplay, GuessPicker, RollResultBadge } from "./DiceDisplay";
import { RollResult } from "../types";

interface Props {
  contractAddress: string;
  signer: ethers.JsonRpcSigner | null;
  onRefreshBalance: () => void;
}

type Phase = "idle" | "committed" | "revealing" | "done" | "error";

interface GameCommit {
  gameId: bigint;
  guess: number;
  userSeed: string;
  betAmount: bigint;
  serverSeedHash: string;
  commitTxHash: string;
}

export function CommitRevealDemo({ contractAddress, signer, onRefreshBalance }: Props) {
  const [guess, setGuess] = useState(1);
  const [betEth, setBetEth] = useState("0.01");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingCommit, setPendingCommit] = useState<GameCommit | null>(null);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [rolling, setRolling] = useState(false);

  // In a real casino, the server seed would come from the backend.
  // For local demo, we use a deterministic test seed that was pre-committed.
  const DEMO_SERVER_SEED = "0x" + ethers.id("local-test-server-seed-epoch-1").slice(2);

  const commit = useCallback(async () => {
    if (!signer || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
      alert("请先部署合约并连接钱包");
      return;
    }

    setPhase("idle");
    setRolling(true);
    setStatusMsg("生成随机用户种子...");

    try {
      const contract = new ethers.Contract(contractAddress, COMMIT_REVEAL_ABI, signer);

      // Generate random user seed
      const userSeed = ethers.hexlify(ethers.randomBytes(32));
      setStatusMsg("提交用户种子哈希（阶段 1）...");

      const tx = await contract.commit(guess, userSeed, {
        value: ethers.parseEther(betEth),
      });

      setStatusMsg(`等待确认... ${tx.hash.slice(0, 12)}...`);
      const receipt = await tx.wait();

      // Parse GameCommitted event
      const event = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "GameCommitted");

      if (event) {
        const commit: GameCommit = {
          gameId: event.args.gameId as bigint,
          guess,
          userSeed,
          betAmount: ethers.parseEther(betEth),
          serverSeedHash: event.args.serverSeedHash as string,
          commitTxHash: tx.hash,
        };
        setPendingCommit(commit);
        setPhase("committed");
        setStatusMsg("✅ 承诺成功！等待庄家揭示（阶段 2）...");
      }
    } catch (err: unknown) {
      setPhase("error");
      setStatusMsg(err instanceof Error ? err.message : "提交失败");
    }

    setRolling(false);
  }, [signer, contractAddress, guess, betEth]);

  const reveal = useCallback(async () => {
    if (!signer || !pendingCommit) return;

    setPhase("revealing");
    setRolling(true);
    setStatusMsg("庄家揭示服务器种子（阶段 2）...");

    try {
      const contract = new ethers.Contract(contractAddress, COMMIT_REVEAL_ABI, signer);

      const tx = await contract.reveal(
        pendingCommit.gameId,
        DEMO_SERVER_SEED,
        pendingCommit.userSeed
      );

      setStatusMsg(`等待确认... ${tx.hash.slice(0, 12)}...`);
      const receipt = await tx.wait();

      const event = receipt?.logs
        .map((log: ethers.Log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: ethers.LogDescription | null) => e?.name === "GameRevealed");

      if (event) {
        const result = Number(event.args.result);
        const won = event.args.won as boolean;
        const entry: RollResult = {
          gameId: pendingCommit.gameId,
          guess: pendingCommit.guess,
          result,
          won,
          betAmount: pendingCommit.betAmount,
          payout: won ? pendingCommit.betAmount * 5n : 0n,
          txHash: tx.hash,
          state: "completed",
          timestamp: Date.now(),
          randomSource: `hash(serverSeed XOR userSeed XOR blockhash)`,
        };
        setLastResult(entry);
        setHistory((h) => [entry, ...h].slice(0, 20));
        setPhase("done");
        setStatusMsg(won ? "🎉 赢了！随机数已验证。" : "💸 输了，但随机数是公平的。");
        onRefreshBalance();
      }
    } catch (err: unknown) {
      setPhase("error");
      setStatusMsg(err instanceof Error ? err.message : "揭示失败");
    }

    setPendingCommit(null);
    setRolling(false);
  }, [signer, contractAddress, pendingCommit, DEMO_SERVER_SEED, onRefreshBalance]);

  const reset = () => {
    setPhase("idle");
    setPendingCommit(null);
    setLastResult(null);
    setStatusMsg("");
  };

  const isDeployed = contractAddress !== "0x0000000000000000000000000000000000000000";

  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🟡</span>
          <div>
            <div className="font-bold text-yellow-300 mb-1">中等安全：两阶段承诺揭示</div>
            <div className="text-sm text-yellow-200/70">
              庄家预先承诺 serverSeedHash，玩家提交明文 userSeed（合约内部哈希）。
              庄家揭示后双方种子合并结算；主要风险是庄家拒绝揭示（有超时保护机制）。
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

      {/* Phase indicator */}
      <div className="flex items-center gap-4">
        {[
          { id: "idle", label: "待机", phase: "idle" },
          { id: "commit", label: "阶段1: 承诺", phase: "committed" },
          { id: "reveal", label: "阶段2: 揭示", phase: "revealing" },
          { id: "done", label: "完成", phase: "done" },
        ].map((step, i, arr) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                phase === step.phase
                  ? "bg-yellow-500/20 border border-yellow-500 text-yellow-300"
                  : ["committed", "revealing", "done"].includes(phase) && i < arr.findIndex(s => s.phase === phase)
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-gray-800 border border-gray-700 text-gray-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center border border-current">
                {i + 1}
              </span>
              {step.label}
            </div>
            {i < arr.length - 1 && (
              <div className="w-4 h-px bg-gray-600 mx-1" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game panel */}
        <div className="bg-casino-card border border-casino-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">骰子游戏</h3>

          <div className="flex flex-col items-center gap-6">
            <DiceDisplay
              result={lastResult?.result}
              rolling={rolling}
              size="lg"
            />

            {phase === "idle" || phase === "error" || phase === "done" ? (
              <>
                <div>
                  <div className="text-sm text-gray-400 mb-2">选择你的猜测</div>
                  <GuessPicker
                    value={guess}
                    onChange={setGuess}
                    disabled={rolling || !isDeployed}
                  />
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
                    className="w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500 disabled:opacity-50"
                  />
                </div>

                <button
                  onClick={phase === "done" ? reset : commit}
                  disabled={rolling || !signer || !isDeployed}
                  className="w-full py-3 rounded-xl font-bold text-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 transition-all text-black"
                >
                  {phase === "done" ? "🔄 再来一局" : "📝 提交承诺（阶段 1）"}
                </button>
              </>
            ) : phase === "committed" ? (
              <>
                <div className="w-full p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-sm">
                  <div className="text-blue-300 font-semibold mb-2">✅ 承诺已提交</div>
                  <div className="space-y-1 text-gray-400 font-mono text-xs">
                    <div>Game ID: {pendingCommit?.gameId.toString()}</div>
                    <div>用户种子: {pendingCommit?.userSeed.slice(0, 20)}...</div>
                    <div>服务器种子哈希: {pendingCommit?.serverSeedHash.slice(0, 20)}...</div>
                  </div>
                </div>

                <button
                  onClick={reveal}
                  disabled={rolling || !signer}
                  className="w-full py-3 rounded-xl font-bold text-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-all text-white"
                >
                  🎯 揭示结果（阶段 2）
                </button>
              </>
            ) : null}

            {statusMsg && (
              <div className={`w-full text-sm p-3 rounded-lg text-center ${
                phase === "error" ? "bg-red-900/30 text-red-300" : "bg-gray-800 text-gray-300"
              }`}>
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
          </div>
        </div>

        {/* Technical details */}
        <div className="space-y-4">
          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">工作原理</h3>
            <pre className="text-xs text-green-300 font-mono overflow-x-auto bg-black/50 rounded p-3">
{`// 阶段 1：玩家承诺
playerCommit = keccak256(userSeed, nonce)
// → 记录到链上，guess 和 bet 锁定

// 阶段 2：庄家揭示
// 验证服务器种子匹配预承诺哈希
require(keccak256(serverSeed) == serverSeedHash)
// 验证用户种子匹配玩家承诺
require(keccak256(userSeed, nonce) == playerCommit)

// 组合熵
combined = keccak256(
  serverSeed,      // 庄家提供
  userSeed,        // 玩家提供
  blockhash(commitBlock),  // 区块熵
  player
)
result = (combined % 6) + 1`}
            </pre>
          </div>

          <div className="bg-casino-card border border-casino-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">安全保障</h3>
            <ul className="text-xs text-gray-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                庄家种子在玩家提交前已锁定（无法针对用户种子作弊）
              </li>
              <li className="flex gap-2">
                <span className="text-green-400">✅</span>
                玩家种子在揭示前已锁定（无法针对服务器种子作弊）
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">⚠️</span>
                超时保护：若庄家 50 块内不揭示，玩家可取回押注
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">⚠️</span>
                需要信任庄家愿意揭示（赢局时可能拒绝揭示）
              </li>
            </ul>
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
