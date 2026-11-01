"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { SiteHeader } from "@/components/site-header";
import { apiFetch } from "@/lib/api-client";
import type { ProfileResponse } from "@/types/api";

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value} pts`;
}

function ProfileContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      apiFetch<ProfileResponse>("/api/profile")
        .then((response) => { if (current) setProfile(response); })
        .catch((loadError) => { if (current) setError(loadError instanceof Error ? loadError.message : "Could not load profile"); });
    }, 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, []);

  async function logout() {
    setError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Could not log out");
    }
  }

  if (!profile) return error ? <p className="error" role="alert">{error}</p> : <p role="status">Loading profile…</p>;

  return (
    <>
      <SiteHeader />
      <section className="profile-heading">
        <div>
          <p className="eyebrow">Branch {profile.user.branch ?? "not assigned"}</p>
          <h1>{profile.user.email}</h1>
        </div>
        <button className="button secondary" onClick={logout}>Log out</button>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="stats-grid" aria-label="Player stats">
        <article className="stat"><span>Balance</span><strong>{profile.user.balance} pts</strong></article>
        <article className="stat"><span>Season rank</span><strong>#{profile.rank}</strong></article>
        <article className="stat"><span>Settled score</span><strong className={profile.score < 0 ? "negative" : "positive"}>{signed(profile.score)}</strong></article>
      </section>
      <section className="history-section">
        <h2>Settled predictions</h2>
        {!profile.settled_bets.length ? <p className="empty-state">No settled predictions yet.</p> : (
          <div className="history-list">
            {profile.settled_bets.map((bet) => (
              <article className="panel history-card" key={`${bet.market_id}-${bet.topic_id}`}>
                <div><p className="eyebrow">{bet.subject}</p><h3>{bet.topic}</h3><p>{bet.side.toUpperCase()} · {bet.stake} pts · outcome {bet.outcome.toUpperCase()}</p></div>
                <div className="history-result"><span>Payout {bet.payout} pts</span><strong className={bet.net < 0 ? "negative" : "positive"}>{signed(bet.net)}</strong></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function ProfilePage() {
  return <main className="page-shell"><AuthGuard>{() => <ProfileContent />}</AuthGuard></main>;
}
