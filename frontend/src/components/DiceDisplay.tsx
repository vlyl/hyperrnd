import { useState, useEffect } from "react";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

interface DiceDisplayProps {
  result?: number;
  rolling?: boolean;
  size?: "sm" | "md" | "lg";
}

export function DiceDisplay({ result, rolling, size = "md" }: DiceDisplayProps) {
  const [displayFace, setDisplayFace] = useState(0);

  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setDisplayFace(Math.floor(Math.random() * 6));
      }, 100);
      return () => clearInterval(interval);
    } else if (result !== undefined) {
      setDisplayFace(result - 1);
    }
  }, [rolling, result]);

  const sizes = {
    sm: "text-4xl",
    md: "text-6xl",
    lg: "text-8xl",
  };

  return (
    <div
      className={`${sizes[size]} select-none transition-all duration-100 ${
        rolling ? "animate-spin-slow" : result ? "animate-bounce" : ""
      }`}
      style={{ filter: rolling ? "blur(1px)" : "none" }}
    >
      {DICE_FACES[displayFace] ?? "🎲"}
    </div>
  );
}

interface GuessPickerProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function GuessPicker({ value, onChange, disabled }: GuessPickerProps) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          disabled={disabled}
          className={`w-10 h-10 rounded-lg font-bold text-lg transition-all ${
            value === n
              ? "bg-casino-gold text-black scale-110 shadow-lg shadow-yellow-500/30"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {DICE_FACES[n - 1]}
        </button>
      ))}
    </div>
  );
}

interface RollResultBadgeProps {
  won: boolean;
  guess: number;
  result: number;
  payout?: bigint;
  bet?: bigint;
}

export function RollResultBadge({ won, guess, result, payout, bet }: RollResultBadgeProps) {
  const ethFormat = (n: bigint) => parseFloat((Number(n) / 1e18).toFixed(4));

  return (
    <div
      className={`p-4 rounded-xl border ${
        won
          ? "bg-green-900/30 border-green-500/50 text-green-300"
          : "bg-red-900/30 border-red-500/50 text-red-300"
      }`}
    >
      <div className="text-2xl font-bold mb-1">
        {won ? "🎉 赢了！" : "💸 输了"}
      </div>
      <div className="text-sm space-y-1 text-gray-300">
        <div>
          猜测: {DICE_FACES[guess - 1]} → 结果: {DICE_FACES[result - 1]}
        </div>
        {bet !== undefined && (
          <div>
            {won
              ? `+${payout ? ethFormat(payout) : ethFormat(bet * BigInt(5))} HYPE`
              : `-${ethFormat(bet)} HYPE`}
          </div>
        )}
      </div>
    </div>
  );
}
