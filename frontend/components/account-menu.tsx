"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import { RankIcon, rankName } from "@/components/rank-icons";

export function AccountMenu({ username, xp: initialXp = 0 }: { username: string; xp?: number }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [xp, setXp] = useState(initialXp);
  const level = Math.min(Math.floor(xp / 100), 4);
  const progress = level === 4 ? 100 : xp % 100;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let current = true;
    apiFetch<{ user: { xp: number } }>("/api/profile")
      .then((profile) => {
        if (current) setXp(profile.user.xp);
      })
      .catch(() => {
        // Keep the latest XP already available from the authenticated user.
      });
    return () => {
      current = false;
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/login", { transitionTypes: ["nav-back"] });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="grid size-11 place-items-center overflow-hidden border-2 border-ink bg-[#c8baff] font-black text-ink shadow-[3px_3px_0_#111] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet max-sm:size-[42px]"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
      >
        {username.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(19rem,calc(100vw-24px))] border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_#111]" role="menu" aria-label="Account menu">
          <p className="mb-2 mt-0 truncate font-extrabold">{username}</p>
          <p className="mb-1 mt-0 flex items-center justify-between gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-[#e7e0ff] px-1.5 py-1 text-[#4e3c9a]"><RankIcon level={level} className="size-6 p-1" /><span>{rankName(level)}</span></span><span>{xp} XP</span>
          </p>
          <div className="h-1.5 overflow-hidden border border-ink bg-white" role="progressbar" aria-label="Progress to next level" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span className="block h-full bg-acid" style={{ width: `${progress}%` }} />
          </div>
          <p className="mb-2 mt-1 text-center text-xs text-ink-soft">
            {level === 0 ? "Start grinding boy" : level === 4 ? "Top level reached" : `${100 - progress} XP to ${rankName(level + 1)}`}
          </p>
          <div className="-mx-1 border-t border-ink/20 pt-1">
            <Link className="block px-2 py-1.5 text-sm font-bold text-ink no-underline hover:bg-paper focus-visible:bg-paper focus-visible:outline-none" href="/profile" transitionTypes={["nav-forward"]} role="menuitem" onClick={() => setOpen(false)}>Profile</Link>
            <button className="block w-full px-2 py-1.5 text-left text-sm font-bold text-danger hover:bg-[#fff0ed] focus-visible:bg-[#fff0ed] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" onClick={() => void signOut()} disabled={signingOut} role="menuitem" type="button">{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
