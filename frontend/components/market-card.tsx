import Link from "next/link";

import type { MarketSummary } from "@/types/api";

export function MarketCard({ market }: { market: MarketSummary }) {
  return (
    <article className="market-card">
      <div>
        <p className="eyebrow">{market.exam_type} · {market.status}</p>
        <h3><Link href={`/rooms/${market.id}`}>{market.subject}</Link></h3>
      </div>
      <p>Locks {new Date(market.lockout_at).toLocaleString()}</p>
    </article>
  );
}
