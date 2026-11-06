"use client";

import Link from "next/link";

import { BetForm } from "@/components/bet-form";
import { Check } from "@/components/icons";
import { MarketSchedule } from "@/components/market-schedule";
import { PayoutEstimate } from "@/components/payout-estimate";
import { PoolDistribution } from "@/components/pool-distribution";
import type { MarketDetail } from "@/types/api";

export function PlayerSubject({
  market,
  balance,
  onRefresh,
}: {
  market: MarketDetail;
  balance: number;
  onRefresh: () => Promise<void>;
}) {
  return (
    <article className="overflow-hidden border-2 border-ink bg-surface shadow-[6px_6px_0_#111]">
      <header className="flex items-start justify-between gap-5 border-b-2 border-ink bg-white px-6 py-5 max-sm:flex-col">
        <div>
          <h2 className="m-0 text-2xl font-black tracking-tight">
            <Link
              className="no-underline hover:underline"
              href={`/rooms/${market.id}`}
              transitionTypes={["nav-forward"]}
            >
              {market.subject}
            </Link>
          </h2>
          <p className="mb-0 text-sm font-bold text-ink-soft">
            {market.exam_type} · {market.status}
          </p>
          <MarketSchedule startsAt={market.starts_at} endsAt={market.ends_at} />
        </div>
      </header>

      <div className="p-4 sm:p-6">
        <div className="grid gap-3">
          {market.topics.map((topic) => {
            return (
              <div
                className="grid gap-4 border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_#111]"
                key={topic.id}
              >
                <div>
                  <strong className="block text-lg">{topic.title}</strong>
                  <span className="text-sm text-ink-soft">
                    {topic.tier === "high" ? "Specific question" : "Topic"}
                  </span>
                </div>

                <PoolDistribution
                  pool={topic.pool}
                  isLive={market.status === "open"}
                />

                {topic.my_bet ? (
                  <div className="grid gap-2">
                    <p className="m-0 flex items-center gap-2 font-bold">
                      <Check />
                      <span>
                        {topic.my_bet.side === "hit" ? "Hit" : "Miss"}
                      </span>
                      <strong>{topic.my_bet.stake} pts</strong>
                    </p>
                    {market.status === "settled" ? (
                      <p className="m-0 rounded-lg bg-white px-3 py-2 text-sm font-bold">
                        Final return:{" "}
                        {topic.my_bet.payout?.toLocaleString() ?? 0} pts
                        {topic.my_bet.net !== undefined && (
                          <span className="ml-2 text-ink-soft">
                            ({topic.my_bet.net >= 0 ? "+" : ""}
                            {topic.my_bet.net.toLocaleString()} pts net)
                          </span>
                        )}
                      </p>
                    ) : (
                      <PayoutEstimate
                        pool={topic.pool}
                        side={topic.my_bet.side}
                        stake={topic.my_bet.stake}
                        stakeAlreadyInPool
                        isLive={market.status === "open"}
                      />
                    )}
                  </div>
                ) : market.status === "open" ? (
                  <BetForm topic={topic} balance={balance} onPlaced={onRefresh} />
                ) : (
                  <span className="justify-self-start border-2 border-ink bg-[#e7e0ff] px-3 py-2 font-mono text-xs font-bold uppercase text-ink">
                    Calls closed
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
