"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthGuard } from "@/components/auth-guard";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageTransition } from "@/components/page-transition";
import { Camera, Flag } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import { useBranches } from "@/lib/use-branches";
import type { Me, ProfileResponse } from "@/types/api";

const inputClass =
  "min-h-11 w-full border-2 border-ink bg-white px-3 py-2.5 text-ink outline-none focus:ring-3 focus:ring-violet/30";
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink bg-acid px-4 py-2.5 font-extrabold text-ink shadow-[3px_3px_0_#111] disabled:cursor-not-allowed disabled:opacity-50";
const cardClass = "border-2 border-ink bg-surface shadow-[5px_5px_0_#111]";

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value} pts`;
}

function groupCallsByExam<
  T extends {
    market_id: number;
    subject: string;
    exam_type: string;
  },
>(calls: T[]) {
  const exams = new Map<
    number,
    { market_id: number; subject: string; exam_type: string; calls: T[] }
  >();

  for (const call of calls) {
    const exam = exams.get(call.market_id) ?? {
      market_id: call.market_id,
      subject: call.subject,
      exam_type: call.exam_type,
      calls: [],
    };
    exam.calls.push(call);
    exams.set(call.market_id, exam);
  }

  return [...exams.values()];
}

function ProfileContent({ user }: { user: Me }) {
  const { branches } = useBranches();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const activeExams = groupCallsByExam(profile?.active_bets ?? []);
  const pastExams = groupCallsByExam(profile?.settled_bets ?? []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await apiFetch<ProfileResponse>("/api/profile"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load profile",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function logout() {
    setError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/login", { transitionTypes: ["nav-back"] });
    } catch {
      setError("Could not log out");
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);

    try {
      setProfile(
        await apiFetch<ProfileResponse>("/api/profile", {
          method: "PATCH",
          body: JSON.stringify({
            username: form.get("username"),
            full_name: form.get("full_name"),
            branch: form.get("branch"),
            academic_year: form.get("academic_year"),
          }),
        }),
      );
      setEditing(false);
      setMessage("Profile updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update profile",
      );
    }
  }

  async function uploadAvatar(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const body = new FormData();
    body.append("file", file);
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/api/profile/avatar", { method: "POST", body });
      await load();
      setMessage("Avatar updated.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload avatar",
      );
    }
  }

  async function submitBug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);

    try {
      await apiFetch("/api/bug-reports", {
        method: "POST",
        body: JSON.stringify({ message: form.get("message") }),
      });
      setReporting(false);
      setMessage("Bug report saved. Thank you.");
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Could not send report",
      );
    }
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        {error ? (
          <div className="grid justify-items-center gap-4">
            <p
              className="m-0 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
              role="alert"
            >
              {error}
            </p>
            <button className={primaryButtonClass} onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : (
          <p className="font-bold text-ink-soft" role="status">
            Loading your profile…
          </p>
        )}
      </div>
    );
  }

  const initials =
    profile.user.full_name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("") || profile.user.username.slice(0, 2);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <DashboardHeader user={user} />

      <main className="mx-auto w-[min(1120px,calc(100%-40px))] py-[clamp(38px,7vw,76px)] pb-20">
        <h1 className="mb-8 text-[clamp(2.5rem,5vw,4.5rem)] font-black leading-[.95] tracking-tight">
          Your profile
        </h1>
        <p className="-mt-5 mb-8 text-ink-soft">{profile.user.email}</p>

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

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(260px,.78fr)_minmax(0,1.22fr)]">
          <aside className={`${cardClass} p-[clamp(20px,3vw,30px)]`}>
            <div className="relative mb-[22px] grid size-[156px] place-items-center overflow-hidden rounded-full bg-[#e6e0ff] text-[2.6rem] font-black text-night">
              {profile.user.avatar_url ? (
                <Image
                  className="size-full object-cover"
                  src={profile.user.avatar_url}
                  width={156}
                  height={156}
                  unoptimized
                  alt="Your avatar"
                />
              ) : (
                <span>{initials.toUpperCase()}</span>
              )}
              <label
                className="absolute bottom-1 right-1 grid size-[42px] cursor-pointer place-items-center rounded-full border-[3px] border-surface bg-acid"
                title="Change avatar"
              >
                <Camera />
                <span className="sr-only">Change avatar</span>
                <input
                  className="sr-only"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  aria-label="Change avatar"
                  onChange={uploadAvatar}
                />
              </label>
            </div>

            {!editing ? (
              <>
                <h2 className="mb-5 break-words text-2xl font-extrabold">
                  @{profile.user.username}
                </h2>
                <dl className="grid gap-4">
                  <div className="grid gap-1">
                    <dt className="text-sm font-bold text-ink-soft">
                      Full name
                    </dt>
                    <dd className="m-0 font-bold">
                      {profile.user.full_name || "Add your name"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-sm font-bold text-ink-soft">Branch</dt>
                    <dd className="m-0 font-bold">
                      {profile.user.branch || "Not selected"}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-sm font-bold text-ink-soft">
                      Academic year
                    </dt>
                    <dd className="m-0 font-bold">
                      {profile.user.academic_year || "Add your year"}
                    </dd>
                  </div>
                </dl>
                <button
                  className={`${primaryButtonClass} mt-6 w-full`}
                  onClick={() => setEditing(true)}
                >
                  Edit profile
                </button>
              </>
            ) : (
              <form className="mt-4 grid gap-4" onSubmit={updateProfile}>
                <label className="grid gap-2 text-sm font-bold">
                  Username
                  <input
                    className={inputClass}
                    name="username"
                    defaultValue={profile.user.username}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Full name
                  <input
                    className={inputClass}
                    name="full_name"
                    defaultValue={profile.user.full_name || ""}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Branch
                  <select
                    className={inputClass}
                    name="branch"
                    defaultValue={profile.user.branch || ""}
                    required
                  >
                    {branches.map((branch) => (
                      <option key={branch}>{branch}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Academic year
                  <select
                    className={inputClass}
                    name="academic_year"
                    defaultValue={profile.user.academic_year || ""}
                    required
                  >
                    <option value="">Choose year</option>
                    <option>FY</option>
                    <option>SY</option>
                    <option>TY</option>
                    <option>Final year</option>
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className={primaryButtonClass}>Save changes</button>
                  <button
                    className="px-2 py-2.5 font-bold text-violet underline underline-offset-4"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6 flex flex-wrap gap-2 border-t-2 border-ink pt-5">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#f0edf8] px-3 py-2.5 font-bold"
                onClick={logout}
              >
                Log out
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#f0edf8] px-3 py-2.5 font-bold"
                onClick={() => setReporting((value) => !value)}
              >
                <Flag /> Report bugs
              </button>
            </div>

            {reporting && (
              <form className="mt-4 grid gap-3" onSubmit={submitBug}>
                <label className="grid gap-2 text-sm font-bold">
                  What went wrong?
                  <textarea
                    className={`${inputClass} min-h-[110px] resize-y`}
                    name="message"
                    rows={5}
                    placeholder="Tell us what you clicked and what happened…"
                    required
                  />
                </label>
                <button className={primaryButtonClass}>Submit report</button>
              </form>
            )}
          </aside>

          <section className="grid gap-[18px]">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <article
                className={`${cardClass} grid min-h-28 content-between gap-3 p-[18px]`}
              >
                <span className="text-sm font-bold text-ink-soft">
                  Overall profit / loss
                </span>
                <strong
                  className={`text-4xl font-black ${profile.score < 0 ? "text-danger" : "text-success"}`}
                >
                  {signed(profile.score)}
                </strong>
              </article>
              <article
                className={`${cardClass} grid min-h-28 content-between gap-3 p-[18px]`}
              >
                <span className="text-sm font-bold text-ink-soft">
                  All-time rank
                </span>
                <strong className="text-4xl font-black">
                  #{profile.rank || "—"}
                </strong>
              </article>
            </div>

            <article className={`${cardClass} grid gap-4 p-[22px]`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-ink-soft">
                  Prediction success
                </span>
                <strong className="text-4xl font-black">
                  {profile.success_rate}%
                </strong>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-[#e9e5dc]"
                role="progressbar"
                aria-valuenow={profile.success_rate}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className="block h-full rounded-full bg-acid"
                  style={{ width: `${profile.success_rate}%` }}
                />
              </div>
              <p className="m-0 leading-relaxed text-ink-soft">
                <strong className="text-ink">{profile.prediction_count}</strong>{" "}
                predictions placed across{" "}
                <strong className="text-ink">{profile.subject_count}</strong>{" "}
                subjects
              </p>
            </article>

            <section className={`${cardClass} p-[clamp(18px,3vw,26px)]`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="m-0 text-xl font-extrabold">Active calls</h2>
                <span className="grid size-[30px] place-items-center rounded-full bg-[#e7e0ff] text-sm font-extrabold text-[#4e3c9a]">
                  {profile.active_bets.length}
                </span>
              </div>
              {activeExams.length ? (
                <div className="grid gap-4">
                  {activeExams.map((exam) => (
                    <section
                      className="grid gap-3 border-2 border-ink p-4"
                      key={exam.market_id}
                    >
                      <header className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="m-0 font-extrabold">{exam.subject}</h3>
                          <p className="mb-0 mt-1 text-sm text-ink-soft">
                            {exam.exam_type} examination
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-ink-soft">
                          {exam.calls.length} call
                          {exam.calls.length === 1 ? "" : "s"}
                        </span>
                      </header>
                      <div className="grid gap-2.5">
                        {exam.calls.map((bet) => (
                          <article
                            className="flex items-center justify-between gap-4 border-2 border-ink bg-paper p-3.5 max-sm:items-start max-sm:flex-col"
                            key={bet.topic_id}
                          >
                            <strong className="break-words">{bet.topic}</strong>
                            <div className="grid justify-items-end gap-1 max-sm:justify-items-start">
                              <span className="text-sm text-ink-soft">
                                {bet.side}
                              </span>
                              <strong>{bet.stake} pts</strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="m-0 leading-relaxed text-ink-soft">
                  No active predictions. Your next room is waiting.
                </p>
              )}
            </section>

            <section className={`${cardClass} p-[clamp(18px,3vw,26px)]`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="m-0 text-xl font-extrabold">Past calls</h2>
                <span className="grid size-[30px] place-items-center rounded-full bg-[#e7e0ff] text-sm font-extrabold text-[#4e3c9a]">
                  {profile.settled_bets.length}
                </span>
              </div>
              {pastExams.length ? (
                <div className="grid gap-4">
                  {pastExams.map((exam) => (
                    <section
                      className="grid gap-3 border-2 border-ink p-4"
                      key={exam.market_id}
                    >
                      <header className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="m-0 font-extrabold">{exam.subject}</h3>
                          <p className="mb-0 mt-1 text-sm text-ink-soft">
                            {exam.exam_type} examination
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-ink-soft">
                          {exam.calls.length} call
                          {exam.calls.length === 1 ? "" : "s"}
                        </span>
                      </header>
                      <div className="grid gap-2.5">
                        {exam.calls.map((bet) => (
                          <article
                            className="flex items-center justify-between gap-4 border-2 border-ink bg-paper p-3.5 max-sm:items-start max-sm:flex-col"
                            key={bet.topic_id}
                          >
                            <strong className="break-words">{bet.topic}</strong>
                            <div className="grid justify-items-end gap-1 text-right max-sm:justify-items-start max-sm:text-left">
                              <span className="text-sm text-ink-soft">
                                {bet.side === bet.outcome
                                  ? "Correct"
                                  : "Missed"}{" "}
                                · {bet.stake} pts
                              </span>
                              <strong
                                className={
                                  bet.net < 0 ? "text-danger" : "text-success"
                                }
                              >
                                {signed(bet.net)}
                              </strong>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="m-0 leading-relaxed text-ink-soft">
                  No settled predictions yet.
                </p>
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <PageTransition>
      <AuthGuard>{(user) => <ProfileContent user={user} />}</AuthGuard>
    </PageTransition>
  );
}
