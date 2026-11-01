"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AuthGuard } from "@/components/auth-guard";
import { Countdown } from "@/components/countdown";
import { SiteHeader } from "@/components/site-header";
import { apiFetch } from "@/lib/api-client";
import type { BetSide, MarketDetail, Me, SettlementPreview, TimeResponse, Topic } from "@/types/api";

function BetForm({ topic, onPlaced }: { topic: Topic; onPlaced: () => Promise<void> }) {
  const [side, setSide] = useState<BetSide>(topic.my_bet?.side ?? "hit");
  const [stake, setStake] = useState(topic.my_bet?.stake ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/bets", { method: "POST", body: JSON.stringify({ topic_id: topic.id, side, stake: Number(stake) }) });
      await onPlaced();
    } catch (betError) {
      setError(betError instanceof Error ? betError.message : "Could not place bet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="inline-form">
      <label htmlFor={`side-${topic.id}`}>Prediction for {topic.title}</label>
      <select id={`side-${topic.id}`} value={side} onChange={(event) => setSide(event.target.value as BetSide)}><option value="hit">YES / Hit</option><option value="miss">NO / Miss</option></select>
      <label htmlFor={`stake-${topic.id}`}>Stake for {topic.title}</label>
      <input id={`stake-${topic.id}`} type="number" min="1" step="1" value={stake} onChange={(event) => setStake(Number(event.target.value))} required />
      <button className="button" disabled={busy}>Place final bet on {topic.title}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function RoomContent({ user, marketId }: { user: Me; marketId: number }) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [outcomes, setOutcomes] = useState<Record<number, BetSide>>({});

  const load = useCallback(async () => {
    try {
      const [detail, clock] = await Promise.all([
        apiFetch<MarketDetail>(`/api/markets/${marketId}`),
        apiFetch<TimeResponse>("/api/time"),
      ]);
      setMarket(detail);
      setServerNow(clock.now);
      setOutcomes((current) => Object.fromEntries(detail.topics.map((topic) => [topic.id, current[topic.id] ?? topic.outcome ?? "hit"])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load room");
    }
  }, [marketId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(path: string, success: string) {
    setError(null);
    try {
      await apiFetch(path, { method: "POST", body: JSON.stringify({}) });
      setMessage(success);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    }
  }

  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await apiFetch(`/api/admin/markets/${marketId}/topics`, { method: "POST", body: JSON.stringify({ title: String(form.get("title")), tier: String(form.get("tier")) }) });
      formElement.reset();
      setMessage("Topic added.");
      await load();
    } catch (topicError) { setError(topicError instanceof Error ? topicError.message : "Could not add topic"); }
  }

  async function uploadPaper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return setError("Choose a paper file");
    if (file.size > 10 * 1024 * 1024) return setError("Paper must be 10 MB or smaller");
    const body = new FormData();
    body.append("file", file);
    try {
      await apiFetch(`/api/admin/markets/${marketId}/paper`, { method: "POST", body });
      setMessage("Question paper attached.");
      await load();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Could not upload paper"); }
  }

  async function previewSettlement() {
    try {
      const response = await apiFetch<SettlementPreview>(`/api/admin/markets/${marketId}/settlement-preview`, { method: "POST", body: JSON.stringify({ outcomes }) });
      setPreview(response);
      setMessage("Preview ready. Review the payout total before confirming.");
    } catch (previewError) { setError(previewError instanceof Error ? previewError.message : "Could not preview settlement"); }
  }

  async function confirmSettlement() {
    if (!preview) return;
    try {
      await apiFetch(`/api/admin/markets/${marketId}/settle`, { method: "POST", body: JSON.stringify({ digest: preview.digest }) });
      setPreview(null);
      setMessage("Room settled once. Balances and leaderboard are updated.");
      await load();
    } catch (settleError) { setError(settleError instanceof Error ? settleError.message : "Could not settle room"); }
  }

  if (!market) return error ? <p className="error" role="alert">{error}</p> : <p role="status">Loading room…</p>;

  return (
    <>
      <SiteHeader />
      <p><Link href="/rooms">← All rooms</Link></p>
      <div className="dashboard-heading">
        <div><p className="eyebrow">{market.exam_type} · {market.status}</p><h1>{market.subject}</h1></div>
        <div className="account-summary"><strong>{user.balance} pts</strong>{serverNow && <span><Countdown target={market.lockout_at} serverNow={serverNow} /></span>}</div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}
      {market.status === "open" && user.role === "player" && <button className="button secondary" onClick={() => action(`/api/markets/${marketId}/claim-grant`, "Exam points claimed.")}>Claim {market.grant_pts} exam points</button>}
      {market.paper_available && <p><a href={`/api/markets/${marketId}/paper`}>Download question paper</a></p>}

      <section className="topic-list">
        {market.topics.map((topic) => (
          <article className="panel topic-card" key={topic.id}>
            <p className="eyebrow">{topic.tier} confidence</p>
            <h2>{topic.title}</h2>
            {topic.my_bet && <p>Your prediction: {topic.my_bet.side.toUpperCase()} · {topic.my_bet.stake} pts</p>}
            {market.status === "settled" && <>
              <p>Outcome: {topic.outcome?.toUpperCase()}</p>
              <p>Pool: HIT {topic.pool?.hit ?? 0} · MISS {topic.pool?.miss ?? 0}</p>
              {topic.my_bet && <p>Net: {(topic.my_bet.net ?? 0) > 0 ? "+" : ""}{topic.my_bet.net ?? 0} pts</p>}
            </>}
            {market.status === "open" && user.role === "player" && <BetForm topic={topic} onPlaced={load} />}
          </article>
        ))}
      </section>

      {user.role === "admin" && (
        <section className="panel admin-controls">
          <h2>Admin controls</h2>
          <form className="inline-form" onSubmit={addTopic}>
            <label htmlFor="topic-title">Topic or specific question</label><input id="topic-title" name="title" required />
            <label htmlFor="topic-tier">Tier</label><select id="topic-tier" name="tier"><option value="low">Low</option><option value="high">High</option></select>
            <button className="button">Add topic</button>
          </form>
          <div className="actions">
            <button className="button secondary" onClick={() => action(`/api/admin/markets/${marketId}/publish`, "Room published.")}>Publish room</button>
            <button className="button danger" onClick={() => action(`/api/admin/markets/${marketId}/lock`, "Betting locked.")}>Lock betting now</button>
          </div>
          <form className="inline-form" onSubmit={uploadPaper}>
            <label htmlFor="paper">Question paper (max 10 MB)</label><input id="paper" name="file" type="file" required />
            <button className="button">Upload paper</button>
          </form>
          <div className="settlement-form">
            <h3>Settlement outcomes</h3>
            {market.topics.map((topic) => <div className="outcome-row" key={topic.id}><label htmlFor={`outcome-${topic.id}`}>{topic.title}</label><select id={`outcome-${topic.id}`} value={outcomes[topic.id] ?? "hit"} onChange={(event) => { setPreview(null); setOutcomes((current) => ({ ...current, [topic.id]: event.target.value as BetSide })); }}><option value="hit">YES / Hit</option><option value="miss">NO / Miss</option></select></div>)}
            <button className="button secondary" onClick={previewSettlement}>Preview settlement</button>
            {preview && <div className="notice"><p>Payout total: <strong>{preview.payout_total} pts</strong></p><button className="button danger" onClick={confirmSettlement}>Confirm settlement once</button></div>}
          </div>
        </section>
      )}
    </>
  );
}

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const marketId = Number(params.id);
  return <main className="page-shell"><AuthGuard>{(user) => <RoomContent user={user} marketId={marketId} />}</AuthGuard></main>;
}
