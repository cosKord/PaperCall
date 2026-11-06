"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { Flag, Lock, Plus, Upload } from "@/components/icons";
import { MarketSchedule } from "@/components/market-schedule";
import { PoolDistribution } from "@/components/pool-distribution";
import { apiFetch } from "@/lib/api-client";
import type { MarketDetail, SettlementOutcome, SettlementPreview } from "@/types/api";

const inputClass =
  "min-h-11 border-2 border-ink bg-white px-3 py-2 outline-none focus:ring-3 focus:ring-violet/30";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink bg-acid px-3 py-2 font-black text-ink shadow-[3px_3px_0_#111] disabled:opacity-50";

export function AdminSubject({
  market,
  onRefresh,
}: {
  market: MarketDetail;
  onRefresh: () => Promise<void>;
}) {
  const [outcomes, setOutcomes] = useState<Record<number, SettlementOutcome | "">>(() =>
    Object.fromEntries(
      market.topics.map((topic) => [topic.id, topic.outcome ?? ""]),
    ),
  );
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const allSelected = useMemo(
    () =>
      market.topics.length > 0 &&
      market.topics.every((topic) => outcomes[topic.id]),
    [market.topics, outcomes],
  );

  async function action(path: string, success: string) {
    setError(null);
    setMessage(null);
    setPreview(null);
    try {
      await apiFetch(path, { method: "POST" });
      setMessage(success);
      await onRefresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed",
      );
    }
  }

  async function addMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/markets/${market.id}/topics`, {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          tier: form.get("tier"),
        }),
      });
      setAdding(false);
      setMessage("Market added.");
      await onRefresh();
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add market",
      );
    }
  }

  async function uploadPaper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/markets/${market.id}/paper`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      setMessage("Question paper attached.");
      await onRefresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload paper",
      );
    }
  }

  async function previewSettlement() {
    if (!allSelected)
      return setError("Select Hit, Miss, or Void for every market first.");
    setError(null);
    setMessage(null);
    try {
      setPreview(
        await apiFetch<SettlementPreview>(
          `/api/admin/markets/${market.id}/settlement-preview`,
          {
            method: "POST",
            body: JSON.stringify({ outcomes }),
          },
        ),
      );
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Could not preview settlement",
      );
    }
  }

  async function settle() {
    if (!preview) return setError("Preview settlement before confirming.");
    if (
      !window.confirm(
        `Settle ${market.subject}? This permanently updates every payout and cannot be undone.`,
      )
    )
      return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/markets/${market.id}/settle`, {
        method: "POST",
        body: JSON.stringify({ digest: preview.digest }),
      });
      setPreview(null);
      setMessage("Subject settled. Player balances are updated.");
      await onRefresh();
    } catch (settleError) {
      setError(
        settleError instanceof Error
          ? settleError.message
          : "Could not settle subject",
      );
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

        <span className="border-2 border-ink bg-[#e7e0ff] px-3 py-2 font-mono text-xs font-bold uppercase text-ink">
          {market.status}
        </span>
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
          {market.topics.map((topic) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_minmax(220px,.8fr)_auto] items-center gap-4 border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_#111] max-md:grid-cols-1"
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

              {market.status === "closed" ? (
                <select
                  className={inputClass}
                  aria-label={`Outcome for ${topic.title}`}
                  value={outcomes[topic.id] ?? ""}
                  onChange={(event) => {
                    setPreview(null);
                    setOutcomes((current) => ({
                      ...current,
                      [topic.id]: event.target.value as SettlementOutcome,
                    }));
                  }}
                >
                  <option value="">Outcome</option>
                  <option value="hit">Hit</option>
                  <option value="miss">Miss</option>
                  <option value="void">Void-refund all bets</option>
                </select>
              ) : (
                <span className="rounded-full bg-white px-3 py-2 text-sm font-bold">
                  {topic.outcome}
                </span>
              )}
            </div>
          ))}
        </div>

        {adding && (
          <form
            className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
            onSubmit={addMarket}
          >
            <input
              className={inputClass}
              name="title"
              placeholder="Topic or specific question"
              required
            />
            <select className={inputClass} name="tier">
              <option value="low">Topic</option>
              <option value="high">Specific question</option>
            </select>
            <button className={buttonClass}>Add topic</button>
          </form>
        )}

        <footer className="mt-6 flex flex-wrap gap-2 border-t-2 border-ink pt-5">
          {market.status === "draft" && (
            <>
              <button
                className={buttonClass}
                onClick={() => setAdding((value) => !value)}
              >
                <Plus />
                Add topic
              </button>
              <button
                className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-white px-3 py-2 font-bold shadow-[3px_3px_0_#111]"
                onClick={() =>
                  action(
                    `/api/admin/markets/${market.id}/publish`,
                    "Subject published.",
                  )
                }
              >
                <Flag />
                Publish room
              </button>
            </>
          )}
          {market.status === "open" && (
            <button
              className={buttonClass}
              onClick={() =>
                action(`/api/admin/markets/${market.id}/lock`, "Calls locked.")
              }
            >
              <Lock />
              Lock calls now
            </button>
          )}
          {market.status !== "settled" && (
            <form className="flex gap-2" onSubmit={uploadPaper}>
              <label className="min-h-11 cursor-pointer border-2 border-ink bg-white px-3 py-2 font-bold">
                <Upload />
                Choose question paper
                <input
                  className="sr-only"
                  name="file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                />
              </label>
              <button className="min-h-11 border-2 border-ink bg-white px-3 py-2 font-bold shadow-[3px_3px_0_#111]">
                Upload paper
              </button>
            </form>
          )}
          {market.status === "closed" && (
            <button
              className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-white px-3 py-2 font-bold shadow-[3px_3px_0_#111] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={previewSettlement}
              disabled={!allSelected}
            >
              <Flag />
              Preview settlement
            </button>
          )}
        </footer>
        {preview && (
          <div
            className="mt-4 border-2 border-ink bg-paper p-4 shadow-[3px_3px_0_#111]"
            role="status"
          >
            <p className="m-0">
              Payout total: <strong>{preview.payout_total} pts</strong>
            </p>
            <button
              className="mt-3 inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-danger px-3 py-2 font-bold text-white shadow-[3px_3px_0_#111]"
              onClick={settle}
            >
              Confirm settlement once
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
