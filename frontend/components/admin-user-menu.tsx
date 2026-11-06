"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Close, Eye, More, Trash, Wallet } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import type { AdminUser, ProfileResponse } from "@/types/api";

type PanelMode = "profile" | "balance" | "xp";

const fieldClass =
  "w-full border-2 border-ink bg-white px-3 py-2.5 outline-none focus:ring-3 focus:ring-violet/30";
const menuItemClass =
  "flex w-full items-center gap-2 rounded-md border-2 border-transparent px-3 py-2 text-left font-bold text-ink hover:border-ink hover:bg-paper";

export function AdminUserMenu({
  player,
  onRemoved,
}: {
  player: AdminUser;
  onRemoved: () => Promise<void>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const panelOpen = panelMode !== null;

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setProfile(null);
    setError(null);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!panelOpen) return;

    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const closeButton = panel?.querySelector<HTMLButtonElement>(
      'button[aria-label="Close panel"]',
    );
    closeButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [closePanel, panelOpen]);

  async function openPanel(mode: PanelMode) {
    setMenuOpen(false);
    setPanelMode(mode);
    setProfile(null);
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      setProfile(
        await apiFetch<ProfileResponse>(
          `/api/admin/users/${player.id}/profile`,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this player",
      );
    } finally {
      setLoading(false);
    }
  }

  async function adjustBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amount = Number(form.get("amount"));
    const reason = String(form.get("reason") ?? "").trim();
    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/admin/users/${player.id}/balance-adjustments`, {
        method: "POST",
        body: JSON.stringify({ amount, reason }),
      });
      setProfile(
        await apiFetch<ProfileResponse>(
          `/api/admin/users/${player.id}/profile`,
        ),
      );
      setMessage(`${amount > 0 ? "+" : ""}${amount} points applied.`);
      formElement.reset();
    } catch (adjustError) {
      setError(
        adjustError instanceof Error
          ? adjustError.message
          : "Could not adjust balance",
      );
    }
  }

  async function setXp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const xp = Number(form.get("xp"));
    const reason = String(form.get("reason") ?? "").trim();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${player.id}/xp-adjustments`, {
        method: "POST",
        body: JSON.stringify({ xp, reason }),
      });
      setProfile(await apiFetch<ProfileResponse>(`/api/admin/users/${player.id}/profile`));
      setMessage(`XP set to ${xp}.`);
      formElement.reset();
    } catch (setErrorValue) {
      setError(setErrorValue instanceof Error ? setErrorValue.message : "Could not set XP");
    }
  }

  async function removeUser() {
    setMenuOpen(false);
    const name = player.username || player.email;
    if (
      !window.confirm(
        `Remove ${name}? Their access will be revoked, but historical calls will be preserved.`,
      )
    ) {
      return;
    }

    try {
      await apiFetch(`/api/admin/users/${player.id}`, { method: "DELETE" });
      await onRemoved();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove player",
      );
      setPanelMode("profile");
    }
  }

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          className="grid size-9 place-items-center border-2 border-ink bg-white text-ink shadow-[2px_2px_0_#111] transition-transform hover:-translate-y-0.5"
          aria-label={`More actions for ${player.email}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <More />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-20 mt-2 grid min-w-44 rounded-lg border-2 border-ink bg-surface p-2"
            role="menu"
          >
            <button
              className={menuItemClass}
              role="menuitem"
              onClick={() => void openPanel("profile")}
            >
              <Eye /> View profile
            </button>
            <button
              className={menuItemClass}
              role="menuitem"
              onClick={() => void openPanel("balance")}
            >
              <Wallet /> Edit balance
            </button>
            <button className={menuItemClass} role="menuitem" onClick={() => void openPanel("xp")}>
              Set XP
            </button>
            <button
              className={`${menuItemClass} text-danger hover:bg-[#fff0ed]`}
              role="menuitem"
              onClick={() => void removeUser()}
            >
              <Trash /> Remove user
            </button>
          </div>
        )}
      </div>

      {panelMode && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            className="absolute inset-0 cursor-default bg-night/50"
            aria-label="Close user panel"
            onClick={closePanel}
          />
          <aside
            ref={panelRef}
            className="relative h-full w-full max-w-[480px] overflow-y-auto rounded-l-xl border-l-2 border-ink bg-surface p-6 text-ink sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-panel-title"
            tabIndex={-1}
          >
            <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-ink pb-5">
              <div>
                <span className="text-sm font-bold text-ink-soft">
                  {panelMode === "profile" ? "Player details" : panelMode === "balance" ? "Balance adjustment" : "Set player XP"}
                </span>
                <h2
                  className="mb-0 mt-1 text-2xl font-black"
                  id="admin-user-panel-title"
                >
                  {profile?.user.full_name ||
                    player.username ||
                    player.email.split("@")[0]}
                </h2>
              </div>
              <button
                className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-paper"
                aria-label="Close panel"
                onClick={closePanel}
              >
                <Close />
              </button>
            </header>

            {loading && (
              <p className="text-ink-soft" role="status">
                Loading player details…
              </p>
            )}
            {error && (
              <p
                className="border-2 border-ink bg-[#ffe4df] p-3 font-bold text-danger"
                role="alert"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="border-2 border-ink bg-acid/50 p-3 font-bold text-ink"
                role="status"
              >
                {message}
              </p>
            )}

            {profile && (
              <>
                <div className="mb-6 flex items-center gap-4 border-2 border-ink bg-paper p-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#e6e0ff] font-black text-night">
                    {profile.user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="grid gap-1 break-all">
                    <strong>@{profile.user.username}</strong>
                    <span className="text-sm text-ink-soft">
                      {profile.user.email}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {profile.user.branch || "No branch"} ·{" "}
                      {profile.user.academic_year || "Year not set"}
                    </span>
                  </div>
                </div>

                {panelMode === "profile" ? (
                  <>
                    <dl className="grid grid-cols-2 gap-3">
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">XP</dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">{profile.user.xp}</dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Balance
                        </dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">
                          {profile.user.balance} pts
                        </dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Success rate
                        </dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">
                          {profile.success_rate}%
                        </dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Predictions
                        </dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">
                          {profile.prediction_count}
                        </dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Subjects
                        </dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">
                          {profile.subject_count}
                        </dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Profit / loss
                        </dt>
                        <dd
                          className={`mb-0 mt-1 text-xl font-extrabold ${profile.score < 0 ? "text-danger" : "text-success"}`}
                        >
                          {profile.score > 0 ? "+" : ""}
                          {profile.score} pts
                        </dd>
                      </div>
                      <div className="border-2 border-ink bg-paper p-4">
                        <dt className="text-sm font-bold text-ink-soft">
                          Season rank
                        </dt>
                        <dd className="mb-0 mt-1 text-xl font-extrabold">
                          #{profile.rank || "—"}
                        </dd>
                      </div>
                    </dl>

                    <button
                      className="mt-6 inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink shadow-[3px_3px_0_#111]"
                      onClick={() => setPanelMode("balance")}
                    >
                      <Wallet /> Adjust balance
                    </button>
                    <button className="ml-3 mt-6 inline-flex min-h-11 items-center border-2 border-ink bg-[#e7e0ff] px-4 py-2.5 font-bold text-ink" onClick={() => setPanelMode("xp")}>Set XP</button>
                  </>
                ) : panelMode === "balance" ? (
                  <>
                    <div className="mb-5 flex items-center justify-between border-2 border-ink bg-paper p-4">
                      <span className="font-bold text-ink-soft">
                        Current balance
                      </span>
                      <strong className="text-xl">
                        {profile.user.balance} pts
                      </strong>
                    </div>
                    <form className="grid gap-4" onSubmit={adjustBalance}>
                      <label className="grid gap-2 text-sm font-bold">
                        Points to add or subtract
                        <input
                          className={fieldClass}
                          name="amount"
                          type="number"
                          step="1"
                          placeholder="+50 or -25"
                          required
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold">
                        Reason
                        <textarea
                          className={`${fieldClass} min-h-28 resize-y`}
                          name="reason"
                          rows={4}
                          minLength={3}
                          maxLength={240}
                          placeholder="Why is this adjustment needed?"
                          required
                        />
                      </label>
                      <p className="m-0 text-sm leading-relaxed text-ink-soft">
                        Positive numbers add points; negative numbers deduct
                        them. Every change is recorded in the audit log.
                      </p>
                      <button className="min-h-11 justify-self-start border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink shadow-[3px_3px_0_#111]">
                        Apply adjustment
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="mb-5 flex items-center justify-between border-2 border-ink bg-paper p-4"><span className="font-bold text-ink-soft">Current XP</span><strong className="text-xl">{profile.user.xp}</strong></div>
                    <form className="grid gap-4" onSubmit={setXp}>
                      <label className="grid gap-2 text-sm font-bold">New XP total<input className={fieldClass} name="xp" type="number" min="0" max="1000000" step="1" defaultValue={profile.user.xp} required /></label>
                      <label className="grid gap-2 text-sm font-bold">Reason<textarea className={`${fieldClass} min-h-28 resize-y`} name="reason" rows={4} minLength={3} maxLength={240} placeholder="Why is this XP change needed?" required /></label>
                      <p className="m-0 text-sm leading-relaxed text-ink-soft">Set the player’s total XP. Every change is recorded in the audit log.</p>
                      <button className="min-h-11 justify-self-start border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink shadow-[3px_3px_0_#111]">Save XP</button>
                    </form>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
