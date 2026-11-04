"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { Check } from "@/components/icons";
import { MarketSchedule } from "@/components/market-schedule";
import { PayoutEstimate } from "@/components/payout-estimate";
import { PoolDistribution } from "@/components/pool-distribution";
import { apiFetch } from "@/lib/api-client";
import type { BetSide, MarketDetail } from "@/types/api";

type BetDraft = { side: BetSide | ""; stake: string };

export function PlayerSubject({
  market,
  balance,
  onRefresh,
}: {
  market: MarketDetail;
  balance: number;
  onRefresh: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyTopic, setBusyTopic] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, BetDraft>>({});

  function updateDraft(topicId: number, draft: Partial<BetDraft>) {
    setDrafts((current) => {
      const previous = current[topicId] ?? { side: "", stake: "" };
      return { ...current, [topicId]: { ...previous, ...draft } };
    });
  }

  async function placeBet(event: FormEvent<HTMLFormElement>, topicId: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyTopic(topicId);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({
          topic_id: topicId,
          side: form.get("side"),
          stake: Number(form.get("stake")),
        }),
      });
      setMessage("Prediction locked in.");
      await onRefresh();
    } catch (betError) {
      setError(
        betError instanceof Error
          ? betError.message
          : "Could not place prediction",
      );
    } finally {
      setBusyTopic(null);
    }
  }

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
        {error && (
          <p
            className="mb-4 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            className="mb-4 border-2 border-ink bg-acid/50 p-3 font-bold text-ink"
            role="status"
          >
            {message}
          </p>
        )}

        <div className="grid gap-3">
          {market.topics.map((topic) => {
            const draft = drafts[topic.id] ?? { side: "" as const, stake: "" };
            const stake = Number(draft.stake);

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
                  <form
                    className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end"
                    onSubmit={(event) => placeBet(event, topic.id)}
                  >
                    <label className="grid gap-1 text-sm font-bold">
                      Prediction
                      <select
                        className="min-h-11 border-2 border-ink bg-white px-3 py-2"
                        aria-label={`Prediction for ${topic.title}`}
                        name="side"
                        value={draft.side}
                        onChange={(event) =>
                          updateDraft(topic.id, {
                            side: event.target.value as BetSide | "",
                          })
                        }
                        required
                      >
                        <option value="" disabled>
                          Hit / Miss
                        </option>
                        <option value="hit">Hit</option>
                        <option value="miss">Miss</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold">
                      Stake
                      <input
                        className="min-h-11 w-28 border-2 border-ink bg-white px-3 py-2"
                        aria-label={`Stake for ${topic.title}`}
                        name="stake"
                        type="number"
                        min="1"
                        max={balance}
                        step="1"
                        value={draft.stake}
                        onChange={(event) =>
                          updateDraft(topic.id, { stake: event.target.value })
                        }
                        placeholder="Points"
                        required
                      />
                    </label>
                    <button
                      className="min-h-11 justify-self-start border-2 border-ink bg-acid px-4 py-2 font-black text-ink shadow-[3px_3px_0_#111] disabled:opacity-50"
                      disabled={busyTopic === topic.id || balance < 1}
                    >
                      {busyTopic === topic.id ? "Placing." : "Place"}
                    </button>
                    {draft.side && Number.isSafeInteger(stake) && stake > 0 && (
                      <div className="sm:col-span-3">
                        <PayoutEstimate
                          pool={topic.pool}
                          side={draft.side}
                          stake={stake}
                        />
                      </div>
                    )}
                  </form>
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
