import type { BetSide } from "@/types/api";

export function PoolDistribution({
  pool,
  isLive = false,
  isExample = false,
}: {
  pool?: Record<BetSide, number>;
  isLive?: boolean;
  isExample?: boolean;
}) {
  const hit = pool?.hit ?? 0;
  const miss = pool?.miss ?? 0;
  const total = hit + miss;
  const hitShare = total > 0 ? (hit / total) * 100 : 0;
  const missShare = total > 0 ? 100 - hitShare : 0;
  const hitPercent = Math.round(hitShare);
  const missPercent = total > 0 ? 100 - hitPercent : 0;
  const title = isExample ? "Example pool" : isLive ? "Live pool" : "Pool";

  return (
    <section aria-label={`${title} distribution`}>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
        {title}
      </p>
      {total > 0 ? (
        <div
          className="flex h-10 overflow-hidden border-2 border-ink bg-white text-sm font-black text-ink"
          role="img"
          aria-label={`Hit ${hit.toLocaleString()} points, ${hitPercent} percent; Miss ${miss.toLocaleString()} points, ${missPercent} percent`}
        >
          <div
            className="grid place-items-center bg-gradient-to-r from-[#3685ff] to-[#54f0b3] transition-[width] duration-500"
            style={{ width: `${hitShare}%` }}
            aria-hidden="true"
          >
            {hitShare >= 18 ? "Hit" : null}
          </div>
          <div
            className="grid place-items-center bg-gradient-to-r from-[#ff9b32] to-[#ef45b5] transition-[width] duration-500"
            style={{ width: `${missShare}%` }}
            aria-hidden="true"
          >
            {missShare >= 18 ? "Miss" : null}
          </div>
        </div>
      ) : (
        <div className="grid h-10 place-items-center border-2 border-dashed border-ink bg-paper font-mono text-xs font-bold uppercase text-ink-soft">
          No calls placed yet
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-ink-soft">
        <span>
          <strong className="text-[#2469c7]">Hit</strong> {hit.toLocaleString()}{" "}
          pts · {hitPercent}%
        </span>
        <span>
          <strong className="text-[#bc297d]">Miss</strong>{" "}
          {miss.toLocaleString()} pts · {missPercent}%
        </span>
        <span className="font-bold text-ink">
          Total {total.toLocaleString()} pts
        </span>
      </div>
    </section>
  );
}
