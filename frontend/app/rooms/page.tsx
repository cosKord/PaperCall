"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { AdminUserMenu } from "@/components/admin-user-menu";
import { AdminBranchMenu } from "@/components/admin-branch-menu";
import { AuthGuard } from "@/components/auth-guard";
import { DashboardHeader } from "@/components/dashboard-header";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { PageTransition } from "@/components/page-transition";
import { apiFetch } from "@/lib/api-client";
import { displayName } from "@/lib/branches";
import { useBranches } from "@/lib/use-branches";
import type { AdminUser, Me } from "@/types/api";

const branchColors: Record<string, string> = {
  IT: "border-t-[#4285ff]",
  CSE: "border-t-[#16b989]",
  AIDS: "border-t-[#f05a50]",
  CSBS: "border-t-[#9254df]",
  MECH: "border-t-[#3977a8]",
  CCE: "border-t-[#f2a323]",
};

function BranchGrid({
  branches,
  admin = false,
  onChanged,
}: {
  branches: string[];
  admin?: boolean;
  onChanged?: () => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-2 max-[440px]:grid-cols-1">
      {branches.map((branch, index) => (
        <article
          className={`relative z-0 border-2 border-ink border-t-[7px] bg-white text-ink shadow-[5px_5px_0_#111] transition-transform hover:z-20 hover:-translate-y-1 focus-within:z-20 ${branchColors[branch] ?? ["border-t-[#4285ff]", "border-t-[#16b989]", "border-t-[#f05a50]", "border-t-[#9254df]", "border-t-[#3977a8]", "border-t-[#f2a323]"][index % 6]}`}
          key={branch}
        >
          {admin && onChanged && <AdminBranchMenu branch={branch} onChanged={onChanged} />}
          <Link
            className="flex min-h-[132px] items-center justify-between gap-4 p-5 text-[clamp(1.45rem,2.5vw,2.1rem)] font-black uppercase tracking-tight text-ink no-underline focus-visible:outline-offset-4"
            href={`/branches/${encodeURIComponent(branch.toLowerCase())}`}
            transitionTypes={["nav-forward"]}
            aria-label={`Open ${branch} room`}
          >
            <span>{branch}</span>
          </Link>
        </article>
      ))}
    </div>
  );
}

function PlayerDashboard({ user }: { user: Me }) {
  const { branches } = useBranches();
  return (
    <PageTransition>
      <div className="min-h-screen bg-paper">
        <DashboardHeader user={user} showWelcomeGrant />
        <section className="mx-auto w-[min(1540px,calc(100%-40px))] py-[clamp(34px,5vw,64px)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[.18em] text-ink-soft">
            Player dashboard
          </p>
          <h1 className="mb-10 max-w-[22ch] text-[clamp(2rem,4vw,3.6rem)] font-black leading-none tracking-tight">
            Hi, {user.username || displayName(user.email)}
          </h1>
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[clamp(24px,3vw,40px)] max-[1100px]:grid-cols-1">
            <div className="w-full min-w-0">
              <div className="mb-[18px] flex items-end justify-between gap-5">
                <h2 className="m-0 font-mono text-sm font-bold uppercase tracking-widest">
                  Available rooms
                </h2>
                {user.branch && (
                  <span className="font-bold text-ink-soft">
                    Your branch: {user.branch}
                  </span>
                )}
              </div>
              <BranchGrid branches={branches} />
            </div>
            <div className="pt-[37px] max-[1100px]:pt-0">
              <LeaderboardPanel />
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

function AdminDashboard({ user }: { user: Me }) {
  const { branches, refresh: refreshBranches } = useBranches();
  const [players, setPlayers] = useState<AdminUser[]>([]);
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = branch ? `?branch=${encodeURIComponent(branch)}` : "";
      setPlayers(await apiFetch<AdminUser[]>(`/api/admin/users${query}`));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load users",
      );
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreatingRoom(true);
    setRoomError(null);
    try {
      await apiFetch("/api/admin/branches", {
        method: "POST",
        body: JSON.stringify({ name: form.get("room_name") }),
      });
      setNewRoomOpen(false);
      await refreshBranches();
    } catch (requestError) {
      setRoomError(requestError instanceof Error ? requestError.message : "Could not add room");
    } finally {
      setCreatingRoom(false);
    }
  }

  const refreshRooms = useCallback(async () => {
    await refreshBranches();
    await loadUsers();
  }, [loadUsers, refreshBranches]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-paper">
        <DashboardHeader user={user} />
        <main className="mx-auto w-[min(1540px,calc(100%-40px))] py-[clamp(34px,5vw,64px)]">
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[.18em] text-ink-soft">
            Admin dashboard
          </p>
          <h1 className="mb-10 text-[clamp(2rem,4vw,3.6rem)] font-black leading-none tracking-tight">
            Hi, Admin
          </h1>
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-[clamp(24px,3vw,40px)] max-[1100px]:grid-cols-1">
            <div className="w-full min-w-0">
              <div className="mb-[18px] flex items-end justify-between">
                <h2 className="m-0 font-mono text-sm font-bold uppercase tracking-widest">
                  Branch rooms
                </h2>
                <span className="font-bold text-ink-soft">
                  {branches.length} rooms
                </span>
              </div>
              <BranchGrid admin branches={branches} onChanged={refreshRooms} />
              {!newRoomOpen ? (
                <button className="mt-6 min-h-12 border-2 border-ink bg-acid px-4 py-3 font-extrabold shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5" onClick={() => setNewRoomOpen(true)} type="button">
                  + Add room
                </button>
              ) : (
                <form className="mt-6 grid max-w-xl gap-3 border-2 border-ink bg-white p-4 shadow-[4px_4px_0_#111] sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={createRoom}>
                  <label className="grid gap-1 text-sm font-bold">Room name
                    <input autoFocus className="min-h-11 border-2 border-ink px-3" maxLength={40} minLength={2} name="room_name" required />
                  </label>
                  <button className="min-h-11 border-2 border-ink bg-acid px-4 font-extrabold" disabled={creatingRoom}>{creatingRoom ? "Adding…" : "Add room"}</button>
                  <button className="min-h-11 border-2 border-ink bg-white px-4 font-bold" onClick={() => { setNewRoomOpen(false); setRoomError(null); }} type="button">Cancel</button>
                  {roomError && <p className="m-0 text-sm font-bold text-danger sm:col-span-3" role="alert">{roomError}</p>}
                </form>
              )}

              <section className="mt-24">
                <div className="mb-5 flex items-end justify-between gap-5 max-sm:flex-col max-sm:items-start">
                  <div>
                    <h2 className="m-0 text-xl">Users</h2>
                    <p className="mb-0 text-ink-soft">
                      Inspect access without changing anyone&apos;s selected
                      branch.
                    </p>
                  </div>
                  <label className="grid gap-1 text-xs font-bold">
                    Filter branch
                    <select
                      className="min-w-[180px] border-2 border-ink bg-white px-3 py-2 shadow-[3px_3px_0_#111]"
                      value={branch}
                      onChange={(event) => setBranch(event.target.value)}
                    >
                      <option value="">All branches</option>
                      {branches.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {error && (
                  <p
                    className="rounded-lg bg-[#fff0ed] p-3 font-bold text-danger"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <div className="grid gap-2">
                  {players.map((player) => (
                    <article
                      className="grid min-h-[72px] grid-cols-[42px_minmax(180px,1fr)_90px_105px_38px] items-center gap-3 border-2 border-ink bg-surface p-3.5 shadow-[3px_3px_0_#111] max-sm:grid-cols-[42px_1fr_auto]"
                      key={player.id}
                    >
                      <div className="grid size-10 place-items-center rounded-full bg-[#e6e0ff] font-black">
                        {(player.username || player.email)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="grid gap-1">
                        <strong>
                          {player.username || player.email.split("@")[0]}
                        </strong>
                        <span className="text-xs text-ink-soft">
                          {player.email}
                        </span>
                      </div>
                      <span className="font-extrabold max-sm:hidden">
                        {player.branch || "No branch"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1.5 text-xs font-extrabold max-sm:hidden ${player.active ? "bg-[#ddf3e7] text-[#1d654c]" : "bg-[#fff0ed] text-danger"}`}
                      >
                        {player.active ? "Active" : "Inactive"}
                      </span>
                      <AdminUserMenu player={player} onRemoved={loadUsers} />
                    </article>
                  ))}
                  {loading && (
                    <p
                      className="border-2 border-ink bg-surface p-7 text-center text-ink-soft shadow-[3px_3px_0_#111]"
                      role="status"
                    >
                      Loading users…
                    </p>
                  )}
                  {!loading && !error && players.length === 0 && (
                    <p className="border-2 border-dashed border-ink bg-white p-7 text-center text-ink-soft">
                      No players in this view.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <div className="pt-[37px] max-[1100px]:pt-0">
              <LeaderboardPanel />
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}

export default function RoomsPage() {
  return (
    <AuthGuard>
      {(user) =>
        user.role === "admin" ? (
          <AdminDashboard user={user} />
        ) : (
          <PlayerDashboard user={user} />
        )
      }
    </AuthGuard>
  );
}
