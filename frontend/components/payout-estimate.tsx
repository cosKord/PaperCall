import type { BetSide } from "@/types/api";
import { estimateParimutuelReturn } from "@/lib/payout";

export function PayoutEstimate({
  pool,
  side,
  stake,
  stakeAlreadyInPool = false,
  isLive = true,
  isExample = false,
}: {
  pool?: Record<BetSide, number>;
  side: BetSide;
  stake: number;
  stakeAlreadyInPool?: boolean;
  isLive?: boolean;
  isExample?: boolean;
}) {
  const estimate = estimateParimutuelReturn({
    pool,
    side,
    stake,
    stakeAlreadyInPool,
  });
  if (!estimate) return null;

  const sideLabel = side === "hit" ? "Hit" : "Miss";

  return (
    <div className="border-2 border-ink bg-white px-3 py-2 text-sm shadow-[3px_3px_0_#111]" aria-live="polite">
      <p className="m-0 font-extrabold">
        Estimated return if {sideLabel} wins:{" "}
        {estimate.estimatedReturn.toLocaleString()} pts
      </p>
      <p className="mb-0 mt-0.5 text-ink-soft">
        {estimate.multiplier.toFixed(2)}× multiplier ·{" "}
        {estimate.estimatedNet >= 0 ? "+" : ""}
        {estimate.estimatedNet.toLocaleString()} pts net
      </p>
      <p className="mb-0 mt-1 text-xs text-ink-soft">
        {isExample
          ? "Illustrative estimate. A real pool can shift until calls lock."
          : isLive
          ? stakeAlreadyInPool
            ? "Estimate changes with the live pool until calls lock."
            : "Estimate includes your stake and updates with the live pool until calls lock."
          : "Based on the locked pool; final return is set at settlement."}
      </p>
    </div>
  );
}
