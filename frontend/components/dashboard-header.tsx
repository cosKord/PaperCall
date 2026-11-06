"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import { AccountMenu } from "@/components/account-menu";
import { Coins } from "@/components/icons";
import { BrandName } from "@/components/brand-name";
import { displayName } from "@/lib/branches";
import type { Me, WelcomeGrantResponse } from "@/types/api";
import { apiFetch } from "@/lib/api-client";

const claimCardClass =
  "absolute right-0 top-full z-40 mt-3 w-[min(20rem,calc(100vw-24px))] rounded-xl border-2 border-ink bg-surface p-4 text-ink";

export function DashboardHeader({
  user,
  showWelcomeGrant = false,
  xp,
}: {
  user: Me;
  showWelcomeGrant?: boolean;
  xp?: number;
}) {
  const name = user.username || displayName(user.email);
  const [balanceState, setBalanceState] = useState({
    userId: user.id,
    balance: user.balance,
  });
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [claimCompleted, setClaimCompleted] = useState(false);
  const [successDismissed, setSuccessDismissed] = useState(false);

  const balance =
    balanceState.userId === user.id ? balanceState.balance : user.balance;
  const canClaimWelcomeGrant =
    showWelcomeGrant &&
    user.role === "player" &&
    user.welcome_grant_available === true;

  async function claimWelcomePoints() {
    setClaiming(true);
    setClaimError(null);

    try {
      const result = await apiFetch<WelcomeGrantResponse>(
        "/api/welcome-grant/claim",
        { method: "POST" },
      );
      setBalanceState({ userId: user.id, balance: result.balance });
      setClaimMessage(
        result.granted
          ? "Your 1,000 starting points are ready to use."
          : "Your welcome points were already claimed. Your balance is up to date.",
      );
      setClaimCompleted(true);
    } catch (requestError) {
      setClaimError(
        requestError instanceof Error
          ? requestError.message
          : "Could not claim your starting points",
      );
    } finally {
      setClaiming(false);
    }
  }

  return (
    <header
      className="relative z-20 flex min-h-[72px] items-center justify-between gap-5 border-b-2 border-ink bg-[#eee6d8] px-[clamp(18px,5vw,70px)] py-3 text-ink [background-image:linear-gradient(#cbbba6_1px,transparent_1px),linear-gradient(90deg,#cbbba6_1px,transparent_1px)] [background-size:23px_23px] max-sm:min-h-[64px]"
    >
      <Link
        className="flex items-center gap-2.5 font-black no-underline"
        href="/rooms"
        transitionTypes={["nav-back"]}
        aria-label="PaperCall dashboard"
      >
        <Image className="size-[34px] border-2 border-ink shadow-[2px_2px_0_#111]" src="/images/papercall-logo.png" alt="" width={34} height={34} priority />
        <BrandName />
      </Link>

      <div className="flex items-center gap-3">
        {user.role === "player" && (
          <div className="relative">
            <div
              className="flex min-h-11 min-w-[142px] items-center justify-center gap-2 border-2 border-ink bg-acid px-3.5 py-2 text-ink shadow-[3px_3px_0_#111] max-sm:min-w-0"
              aria-label={`Balance: ${balance} points`}
            >
              <Coins />
              <strong>{balance.toLocaleString()} pts</strong>
            </div>

            {canClaimWelcomeGrant && !dismissed && !claimCompleted && (
              <section
                className={claimCardClass}
                aria-labelledby="welcome-grant-title"
              >
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
                  Welcome to <BrandName />
                </p>
                <h2
                  className="mb-2 mt-0 text-lg font-extrabold"
                  id="welcome-grant-title"
                >
                  Claim your 1,000 starting points
                </h2>
                <p className="mb-4 mt-0 text-sm leading-relaxed text-ink-soft">
                  These points are yours to use across your prediction rooms.
                </p>
                <button
                  className="min-h-11 w-full rounded-lg border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink disabled:cursor-wait disabled:opacity-60"
                  onClick={() => void claimWelcomePoints()}
                  disabled={claiming}
                >
                  {claiming ? "Adding points…" : "Claim 1,000 points"}
                </button>
                <button
                  className="mt-2 min-h-9 w-full rounded-lg px-3 py-2 text-sm font-bold text-ink-soft hover:bg-paper"
                  onClick={() => setDismissed(true)}
                  type="button"
                >
                  Maybe later
                </button>
                {claimError && (
                  <p
                    className="mb-0 mt-3 rounded-lg bg-[#fff0ed] p-2.5 text-sm font-bold text-danger"
                    role="alert"
                  >
                    {claimError}
                  </p>
                )}
              </section>
            )}

            {claimCompleted && !successDismissed && (
              <section className={claimCardClass} role="status">
                <p className="mb-1 font-extrabold text-success">
                  Your balance is updated.
                </p>
                <p className="mb-3 mt-0 text-sm text-ink-soft">
                  {claimMessage}
                </p>
                <button
                  className="rounded-lg px-3 py-2 text-sm font-bold text-violet hover:bg-paper"
                  onClick={() => setSuccessDismissed(true)}
                  type="button"
                >
                  Got it
                </button>
              </section>
            )}
          </div>
        )}

        <AccountMenu username={name} xp={xp ?? user.xp} />
      </div>
    </header>
  );
}
