"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { MarketCard } from "@/components/market-card";
import { SiteHeader } from "@/components/site-header";
import { apiFetch } from "@/lib/api-client";
import type { AdminUser, LeaderboardRow, MarketSummary, Me } from "@/types/api";

function RoomsContent({ user }: { user: Me }) {
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const requests: [Promise<MarketSummary[]>, Promise<LeaderboardRow[]>, Promise<AdminUser[]>] = [
        apiFetch<MarketSummary[]>("/api/markets"),
        apiFetch<LeaderboardRow[]>("/api/leaderboard"),
        user.role === "admin" ? apiFetch<AdminUser[]>("/api/admin/users") : Promise.resolve([]),
      ];
      const [marketRows, leaderRows, userRows] = await Promise.all(requests);
      setMarkets(marketRows);
      setLeaders(leaderRows);
      setUsers(userRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load rooms");
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function assignBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await apiFetch("/api/admin/branches", {
        method: "POST",
        body: JSON.stringify({ user_id: Number(form.get("user_id")), branch: String(form.get("branch") ?? "").trim() }),
      });
      setMessage("Branch assigned.");
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Could not assign branch");
    }
  }

  async function createMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const starts = new Date(String(form.get("starts_at")));
    const ends = new Date(String(form.get("ends_at")));
    const branches = String(form.get("branches") ?? "").split(",").map((branch) => branch.trim()).filter(Boolean);
    setError(null);
    try {
      await apiFetch("/api/admin/markets", {
        method: "POST",
        body: JSON.stringify({
          subject: String(form.get("subject") ?? "").trim(),
          exam_type: String(form.get("exam_type")),
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          home_branches: branches,
          branch_starts: Object.fromEntries(branches.map((branch) => [branch, starts.toISOString()])),
        }),
      });
      formElement.reset();
      setMessage("Draft room created. Open it to add topics and publish.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create room");
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{user.email}</p>
          <h1>Exam rooms</h1>
        </div>
        <div className="account-summary">
          <strong>{user.balance} pts</strong>
          <span>Branch: {user.branch ?? "not assigned"}</span>
        </div>
      </div>

      {!user.branch && user.role === "player" && <p className="notice">An admin must assign your branch before you can claim exam points.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="notice" role="status">{message}</p>}

      {user.role === "admin" && (
        <section className="admin-grid" aria-label="Admin setup">
          <form className="panel stack" onSubmit={createMarket}>
            <h2>Create exam room</h2>
            <label htmlFor="subject">Subject</label>
            <input id="subject" name="subject" required />
            <label htmlFor="exam-type">Exam type</label>
            <select id="exam-type" name="exam_type" defaultValue="midsem"><option value="midsem">Midsem</option><option value="endsem">Endsem</option><option value="other">Other</option></select>
            <label htmlFor="starts-at">Exam starts</label>
            <input id="starts-at" name="starts_at" type="datetime-local" required />
            <label htmlFor="ends-at">Exam ends</label>
            <input id="ends-at" name="ends_at" type="datetime-local" required />
            <label htmlFor="branches">Home branches (comma separated)</label>
            <input id="branches" name="branches" placeholder="CSE, IT" required />
            <button className="button">Create draft</button>
          </form>
          <form className="panel stack" onSubmit={assignBranch}>
            <h2>Assign branch</h2>
            <label htmlFor="user-id">Player</label>
            <select id="user-id" name="user_id" required>
              <option value="">Choose player</option>
              {users.filter((entry) => entry.role === "player").map((entry) => <option key={entry.id} value={entry.id}>{entry.email ?? `User ${entry.id}`} {entry.branch ? `(${entry.branch})` : ""}</option>)}
            </select>
            <label htmlFor="branch">Branch</label>
            <input id="branch" name="branch" placeholder="CSE" required />
            <button className="button">Save branch</button>
          </form>
        </section>
      )}

      <section className="content-grid">
        <div>
          <h2>Available rooms</h2>
          {loading ? <p role="status">Loading rooms…</p> : markets.length ? <div className="card-list">{markets.map((market) => <MarketCard key={market.id} market={market} />)}</div> : <p className="empty-state">No exam rooms yet.</p>}
        </div>
        <aside>
          <h2>Leaderboard</h2>
          <ol className="leaderboard">
            {leaders.map((leader) => <li key={leader.email}><span>{leader.email}</span><strong>{leader.score > 0 ? `+${leader.score}` : leader.score}</strong></li>)}
          </ol>
        </aside>
      </section>
    </>
  );
}

export default function RoomsPage() {
  return <main className="page-shell"><AuthGuard>{(user) => <RoomsContent user={user} />}</AuthGuard></main>;
}
