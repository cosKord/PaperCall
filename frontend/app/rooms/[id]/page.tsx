"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthGuard } from "@/components/auth-guard";
import { BetForm } from "@/components/bet-form";
import { AdminSubject } from "@/components/admin-subject";
import { Countdown } from "@/components/countdown";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageNavbar } from "@/components/page-navbar";
import { MarketSchedule } from "@/components/market-schedule";
import { PayoutEstimate } from "@/components/payout-estimate";
import { PoolDistribution } from "@/components/pool-distribution";
import { PageTransition } from "@/components/page-transition";
import { apiFetch } from "@/lib/api-client";
import type { MarketDetail, Me, TimeResponse } from "@/types/api";

function RoomContent({ user, marketId }: { user: Me; marketId: number }) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, clock] = await Promise.all([
        apiFetch<MarketDetail>(`/api/markets/${marketId}`),
        apiFetch<TimeResponse>("/api/time"),
      ]);
      setMarket(detail);
      setServerNow(clock.now);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load room",
      );
    }
  }, [marketId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (market?.status !== "open") return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, market?.status]);

  if (!market) {
    return (
      <section className="grid min-h-[50vh] place-content-center justify-items-center gap-4 text-center">
        {error ? (
          <>
            <p
              className="m-0 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
              role="alert"
            >
              {error}
            </p>
            <button
              className="min-h-11 border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink shadow-[3px_3px_0_#111]"
              onClick={() => void load()}
            >
              Retry
            </button>
          </>
        ) : (
          <p className="py-8 text-center font-bold text-ink-soft" role="status">
            Loading room…
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <DashboardHeader user={user} />

      <div className="mt-6">
        <PageNavbar />
      </div>

      <div className="my-8 flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start">
        <div>
          <p className="mb-2 font-mono text-xs font-extrabold uppercase tracking-[.18em] text-ink-soft">
            {market.exam_type} · {market.status}
          </p>
          <h1 className="m-0 text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[.92] tracking-tight">
            {market.subject}
          </h1>
          <MarketSchedule startsAt={market.starts_at} endsAt={market.ends_at} />
        </div>
        {serverNow && (
          <div className="border-2 border-ink bg-white px-4 py-2 font-mono text-xs font-bold text-ink shadow-[3px_3px_0_#111]">
            <Countdown target={market.lockout_at} serverNow={serverNow} />
          </div>
        )}
      </div>

      {error && (
        <p
          className="border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {market.paper_available && (
        <p>
          <a
            className="font-bold text-violet underline underline-offset-4"
            href={`/api/markets/${marketId}/paper`}
          >
            Download question paper
          </a>
        </p>
      )}

      {user.role === "admin" ? (
        <section className="my-7">
          <h2 className="mb-4 text-xl font-extrabold">Admin controls</h2>
          <AdminSubject market={market} onRefresh={load} />
        </section>
      ) : (
        <section className="my-7 grid gap-3.5">
          {market.topics.length === 0 && (
            <p className="border-2 border-dashed border-ink bg-white p-7 text-center text-ink-soft">
              No topics are available in this room yet.
            </p>
          )}
          {market.topics.map((topic) => (
            <article
              className="border-2 border-ink bg-surface p-[clamp(18px,4vw,30px)] shadow-[5px_5px_0_#111]"
              key={topic.id}
            >
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                {topic.tier} confidence
              </p>
              <h2 className="mb-3 mt-1 text-xl font-black sm:text-2xl">
                {topic.title}
              </h2>
              <PoolDistribution
                pool={topic.pool}
                isLive={market.status === "open"}
              />
              {topic.my_bet && (
                <p className="text-sm font-bold">
                  Your prediction: {topic.my_bet.side.toUpperCase()} ·{" "}
                  {topic.my_bet.stake} pts
                </p>
              )}
              {topic.my_bet && market.status !== "settled" && (
                <PayoutEstimate
                  pool={topic.pool}
                  side={topic.my_bet.side}
                  stake={topic.my_bet.stake}
                  stakeAlreadyInPool
                  isLive={market.status === "open"}
                />
              )}
              {market.status === "settled" && (
                <div className="grid gap-1 text-sm text-ink-soft">
                  <p>Outcome: {topic.outcome?.toUpperCase()}</p>
                  {topic.my_bet && (
                    <p>
                      Return: {topic.my_bet.payout ?? 0} pts · Net:{" "}
                      {topic.my_bet.net !== undefined && topic.my_bet.net > 0
                        ? "+"
                        : ""}
                      {topic.my_bet.net ?? 0} pts
                    </p>
                  )}
                </div>
              )}
              {market.status === "open" && (
                <BetForm topic={topic} balance={user.balance} onPlaced={load} />
              )}
              {market.status === "closed" && !topic.my_bet && (
                <p className="mb-0 border-2 border-ink bg-[#e7e0ff] p-3 text-sm font-bold text-ink">
                  Calls are locked for this subject.
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const marketId = Number(params.id);

  if (!Number.isSafeInteger(marketId) || marketId < 1) {
    return (
      <PageTransition>
        <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-32px))] py-10 text-ink">
          <h1 className="text-4xl font-black tracking-tight">
            That room doesn&apos;t exist.
          </h1>
          <Link
            className="font-bold text-violet underline underline-offset-4"
            href="/rooms"
            transitionTypes={["nav-back"]}
          >
            Back to rooms
          </Link>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="mx-auto min-h-screen w-[min(1120px,calc(100%-32px))] pb-16 text-ink">
        <AuthGuard>
          {(user) => <RoomContent user={user} marketId={marketId} />}
        </AuthGuard>
      </main>
    </PageTransition>
  );
}
