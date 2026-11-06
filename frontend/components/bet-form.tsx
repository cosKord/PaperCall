"use client";

import { FormEvent, useState } from "react";

import { PayoutEstimate } from "@/components/payout-estimate";
import { apiFetch } from "@/lib/api-client";
import type { BetSide, Topic } from "@/types/api";

const fieldClass =
  "min-h-11 w-full border-2 border-ink bg-white px-3 py-2.5 text-ink outline-none focus:ring-3 focus:ring-violet/30";

export function BetForm({ topic, balance, onPlaced }: {
  topic: Topic;
  balance: number;
  onPlaced: () => Promise<void>;
}) {
  const [side, setSide] = useState<BetSide>("hit");
  const [stake, setStake] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const validStake = Number.isSafeInteger(stake) && stake >= 1 && stake <= balance;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validStake) return;

    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/bets", {
        method: "POST",
        body: JSON.stringify({ topic_id: topic.id, side, stake }),
      });
      await onPlaced();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not place prediction");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,.7fr)_auto] sm:items-end" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm font-bold">
        Prediction
        <select className={fieldClass} aria-label={`Prediction for ${topic.title}`} value={side} onChange={(event) => setSide(event.target.value as BetSide)}>
          <option value="hit">Hit</option>
          <option value="miss">Miss</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-bold">
        Stake
        <input className={fieldClass} aria-label={`Stake for ${topic.title}`} type="number" min="1" max={balance} step="1" value={stake} onChange={(event) => setStake(Number(event.target.value))} required />
      </label>
      <button aria-label={`Place call on ${topic.title}`} className="min-h-11 justify-self-start border-2 border-ink bg-acid px-4 py-2.5 font-black text-ink shadow-[3px_3px_0_#111] disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !validStake}>
        {busy ? "Placing…" : "Place call"}
      </button>
      {validStake && <div className="sm:col-span-3"><PayoutEstimate pool={topic.pool} side={side} stake={stake} /></div>}
      {error && <p className="m-0 text-sm font-bold text-danger sm:col-span-3" role="alert">{error}</p>}
    </form>
  );
}
