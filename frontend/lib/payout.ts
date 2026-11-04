import type { BetSide } from "@/types/api";

export function estimateParimutuelReturn({
  pool,
  side,
  stake,
  stakeAlreadyInPool = false,
}: {
  pool?: Record<BetSide, number>;
  side: BetSide;
  stake: number;
  stakeAlreadyInPool?: boolean;
}) {
  if (!Number.isSafeInteger(stake) || stake <= 0) return null;

  const hitPool = pool?.hit ?? 0;
  const missPool = pool?.miss ?? 0;
  const poolTotal = hitPool + missPool;
  const sidePool = side === "hit" ? hitPool : missPool;
  const addStake = stakeAlreadyInPool ? 0 : stake;
  const winningPool = sidePool + addStake;
  if (winningPool <= 0) return null;

  const estimatedReturn = Math.floor(
    ((poolTotal + addStake) * stake) / winningPool,
  );
  return {
    estimatedReturn,
    estimatedNet: estimatedReturn - stake,
    multiplier: estimatedReturn / stake,
  };
}
