"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminSubject } from "@/components/admin-subject";
import { AuthGuard } from "@/components/auth-guard";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageNavbar } from "@/components/page-navbar";
import { PlayerSubject } from "@/components/player-subject";
import { PageTransition } from "@/components/page-transition";
import { SubjectForm } from "@/components/subject-form";
import { apiFetch } from "@/lib/api-client";
import { branchHighlight } from "@/lib/branch-colors";
import { useBranches } from "@/lib/use-branches";
import type { MarketDetail, Me } from "@/types/api";

function SubjectList({
  list,
  user,
  onRefresh,
}: {
  list: MarketDetail[];
  user: Me;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      {list.map((market) =>
        user.role === "admin" ? (
          <AdminSubject market={market} onRefresh={onRefresh} key={market.id} />
        ) : (
          <PlayerSubject
            market={market}
            balance={user.balance}
            onRefresh={onRefresh}
            key={market.id}
          />
        ),
      )}
    </div>
  );
}

function BranchRoom({
  initialUser,
  branch,
}: {
  initialUser: Me;
  branch: string;
}) {
  const [user, setUser] = useState(initialUser);
  const [markets, setMarkets] = useState<MarketDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refreshUser = false) => {
    setError(null);
    try {
      const details = await apiFetch<MarketDetail[]>(
        `/api/markets?branch=${encodeURIComponent(branch)}&include_topics=1`,
      );
      const visibleMarkets =
        initialUser.role === "admin"
          ? details
          : details.filter((market) => market.status !== "draft");
      setMarkets(visibleMarkets);
      if (refreshUser) setUser(await apiFetch<Me>("/api/me"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load this room",
      );
    } finally {
      setLoading(false);
    }
  }, [branch, initialUser.role]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!markets.some((market) => market.status === "open")) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load, markets]);

  const isAdmin = user.role === "admin";
  const bannerColor = branchHighlight(branch);
  const active = markets.filter((market) =>
    isAdmin
      ? market.status === "open" || market.status === "draft"
      : market.status === "open",
  );
  const inactive = markets.filter(
    (market) => market.status === "closed" || market.status === "settled",
  );
  const visibleMarkets = isAdmin
    ? markets
    : markets.filter((market) => market.status !== "draft");

  return (
    <div className="min-h-screen bg-paper">
      <DashboardHeader user={user} />
      <section className="pb-10">
        <div className="pt-[clamp(24px,4vw,40px)]"><PageNavbar /></div>
        <div className="relative isolate mt-7 overflow-hidden border-y-2 border-ink shadow-[0_5px_0_#111]" style={{ backgroundColor: bannerColor }}>
          <div
            className="pointer-events-none absolute inset-0 opacity-25 [image-rendering:pixelated]"
            aria-hidden="true"
            style={{
              backgroundImage: "repeating-conic-gradient(rgba(255,255,255,.32) 0% 25%, transparent 0% 50%)",
              backgroundSize: "128px 128px",
            }}
          />
          <div className="mx-auto flex min-h-56 w-[min(1080px,calc(100%-40px))] items-center justify-between gap-6 py-9 max-sm:min-h-48">
          <div className="relative">
            <p className="mb-2 font-mono text-xs font-extrabold uppercase tracking-[.18em] text-ink-soft">
              {isAdmin ? "Admin room" : "Your prediction floor"}
            </p>
            <h1 className="m-0 text-[clamp(2.3rem,5vw,4.2rem)] font-black leading-none tracking-tight">
              Room: {branch}
            </h1>
            <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
              {isAdmin
                ? "Create, lock and settle subjects from here."
                : "Place each call separately. Live Hit and Miss pools show how points are distributed."}
            </p>
          </div>
          </div>
        </div>
        <div className="mx-auto w-[min(1080px,calc(100%-40px))]">
        {error && (
          <p
            className="mt-8 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
        {loading && (
          <div
            className="mt-10 border-2 border-ink bg-surface p-8 text-ink-soft shadow-[4px_4px_0_#111]"
            role="status"
          >
            Loading subjects.
          </div>
        )}
        {!loading && active.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-center justify-between border-b-2 border-ink pb-3">
              <h2 className="m-0 font-mono text-sm font-bold uppercase tracking-widest">
                {isAdmin ? "Live subjects" : "Active calls"}
              </h2>
              <span className="border-2 border-ink bg-white px-3 py-1 font-mono text-xs font-bold text-ink">
                {active.length} subject{active.length === 1 ? "" : "s"}
              </span>
            </div>
            <SubjectList list={active} user={user} onRefresh={() => load(true)} />
          </section>
        )}
        {!loading && inactive.length > 0 && (
          <section className="mt-12">
            <div className="mb-5 flex items-center justify-between border-b-2 border-ink pb-3">
              <h2 className="m-0 font-mono text-sm font-bold uppercase tracking-widest">
                Closed & settled
              </h2>
              <span className="border-2 border-ink bg-white px-3 py-1 font-mono text-xs font-bold text-ink">
                {inactive.length}
              </span>
            </div>
            <SubjectList list={inactive} user={user} onRefresh={() => load(true)} />
          </section>
        )}
        {!loading && visibleMarkets.length === 0 && (
          <div className="mt-10 border-2 border-dashed border-ink bg-white p-10 text-center shadow-[4px_4px_0_#111]">
            <strong>Nothing on the board yet.</strong>
            <p className="mb-0 text-ink-soft">
              {isAdmin
                ? `Create the first ${branch} subject below.`
                : `When an admin publishes a ${branch} subject, it will appear here.`}
            </p>
          </div>
        )}
        {isAdmin && <SubjectForm defaultBranch={branch} onCreated={load} />}
        </div>
      </section>
    </div>
  );
}

export default function BranchPage() {
  const params = useParams<{ branch: string }>();
  const branch = params.branch.toUpperCase();
  const { branches, loaded } = useBranches();

  if (!loaded)
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-center" role="status">
        <p className="font-bold text-ink-soft">Loading rooms…</p>
      </main>
    );

  if (!branches.includes(branch))
    return (
      <PageTransition>
        <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              That room doesn&apos;t exist.
            </h1>
            <Link
              className="inline-block border-2 border-ink bg-acid px-4 py-3 font-extrabold text-ink no-underline shadow-[4px_4px_0_#111]"
              href="/rooms"
              transitionTypes={["nav-back"]}
            >
              Back to dashboard
            </Link>
          </div>
        </main>
      </PageTransition>
    );
  return (
    <PageTransition>
      <AuthGuard>
        {(user) => <BranchRoom initialUser={user} branch={branch} />}
      </AuthGuard>
    </PageTransition>
  );
}
