"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";

import { ArrowLeft, ArrowRight } from "@/components/icons";
import { BrandName } from "@/components/brand-name";
import { PageTransition } from "@/components/page-transition";
import { TapedExamPaper } from "@/components/taped-exam-paper";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";
import { useBranches } from "@/lib/use-branches";
import { minecraftBold } from "@/lib/fonts";
import type { Me } from "@/types/api";

type Step = "account" | "branch" | "admin";
type SessionExchangeResponse = { ok: true; needs_branch: boolean };
const promoHeadline = "Will the question you skipped show up?";

const controlClass =
  "w-full border-2 border-ink bg-white px-[13px] py-3 outline-none focus:ring-3 focus:ring-violet/30";
const actionClass =
  "inline-flex min-h-12 items-center justify-center gap-2.5 border-2 border-ink bg-acid px-[18px] py-[13px] font-extrabold text-ink shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50";

export default function LoginPage() {
  const { branches, loaded: branchesLoaded } = useBranches();
  const router = useRouter();
  const oauthHandled = useRef(false);
  const promoPanelRef = useRef<HTMLElement | null>(null);
  const draggedShapeRef = useRef<{
    element: HTMLElement;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    velocityX: number;
    velocityY: number;
  } | null>(null);
  const [step, setStep] = useState<Step>("account");
  const [branch, setBranch] = useState("");
  const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typedHeadline, setTypedHeadline] = useState("");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let character = 0;
    let typing: number | undefined;
    const startTyping = window.setTimeout(() => {
      if (reducedMotion.matches) {
        setTypedHeadline(promoHeadline);
        return;
      }
      typing = window.setInterval(() => {
        character += 1;
        setTypedHeadline(promoHeadline.slice(0, character));
        if (character >= promoHeadline.length && typing !== undefined) window.clearInterval(typing);
      }, 58);
    }, 0);

    return () => {
      window.clearTimeout(startTyping);
      if (typing !== undefined) window.clearInterval(typing);
    };
  }, []);

  useEffect(() => {
    const panel = promoPanelRef.current;
    if (!panel || typeof IntersectionObserver === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shapes = Array.from(panel.querySelectorAll<HTMLElement>("[data-arcade-float]"));
    let isVisible = false;
    let animations: Animation[] = [];

    function stopAnimations() {
      animations.forEach((animation) => animation.cancel());
      animations = [];
    }

    function startAnimations() {
      if (!isVisible || document.hidden || prefersReducedMotion.matches || animations.length) return;
      animations = shapes.map((shape, index) => {
        const tilt = index % 2 === 0 ? -7 : 7;
        return shape.animate(
          [
            { transform: `translate3d(0, 0, 0) rotate(${tilt}deg)` },
            { transform: `translate3d(0, ${index % 2 === 0 ? -10 : 9}px, 0) rotate(${-tilt}deg)` },
          ],
          {
            duration: 5200 + index * 1100,
            delay: index * -650,
            direction: "alternate",
            easing: "ease-in-out",
            iterations: Infinity,
          },
        );
      });
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) startAnimations();
      else stopAnimations();
    });
    const handleMotionPreference = () => {
      if (prefersReducedMotion.matches) stopAnimations();
      else startAnimations();
    };
    const handleVisibility = () => {
      if (document.hidden) stopAnimations();
      else startAnimations();
    };

    observer.observe(panel);
    prefersReducedMotion.addEventListener("change", handleMotionPreference);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      observer.disconnect();
      prefersReducedMotion.removeEventListener("change", handleMotionPreference);
      document.removeEventListener("visibilitychange", handleVisibility);
      stopAnimations();
    };
  }, []);

  function updatePromoSpotlight(event: ReactPointerEvent<HTMLElement>) {
    if (!promoPanelRef.current) return;
    const dragged = draggedShapeRef.current;
    if (dragged) {
      const panelBounds = promoPanelRef.current.getBoundingClientRect();
      dragged.element.style.left = `${event.clientX - panelBounds.left - dragged.offsetX}px`;
      dragged.element.style.top = `${event.clientY - panelBounds.top - dragged.offsetY}px`;
      dragged.element.style.right = "auto";
      dragged.element.style.bottom = "auto";
      const elapsed = Math.max(event.timeStamp - dragged.lastTime, 1);
      dragged.velocityX = Math.max(-0.65, Math.min(0.65, (event.clientX - dragged.lastX) / elapsed));
      dragged.velocityY = Math.max(-0.65, Math.min(0.65, (event.clientY - dragged.lastY) / elapsed));
      dragged.lastX = event.clientX;
      dragged.lastY = event.clientY;
      dragged.lastTime = event.timeStamp;
    }
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
  }

  function startPromoDrag(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-draggable]") : null;
    if (!target || !promoPanelRef.current) return;
    const bounds = target.getBoundingClientRect();
    draggedShapeRef.current = {
      element: target,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
    };
    target.getAnimations().forEach((animation) => animation.pause());
    target.classList.add("cursor-grabbing");
    promoPanelRef.current.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function endPromoDrag(event: ReactPointerEvent<HTMLElement>) {
    const dragged = draggedShapeRef.current;
    if (!dragged) return;
    dragged.element.classList.remove("cursor-grabbing");
    draggedShapeRef.current = null;
    if (promoPanelRef.current?.hasPointerCapture(event.pointerId)) promoPanelRef.current.releasePointerCapture(event.pointerId);

    let lastFrame = performance.now();
    let velocityX = dragged.velocityX;
    let velocityY = dragged.velocityY;
    const coast = (time: number) => {
      const delta = Math.min(time - lastFrame, 32);
      lastFrame = time;
      const panel = promoPanelRef.current;
      if (panel) {
        const panelBounds = panel.getBoundingClientRect();
        const left = Number.parseFloat(dragged.element.style.left) || 0;
        const top = Number.parseFloat(dragged.element.style.top) || 0;
        dragged.element.style.left = `${Math.max(0, Math.min(panelBounds.width - dragged.element.offsetWidth, left + velocityX * delta))}px`;
        dragged.element.style.top = `${Math.max(0, Math.min(panelBounds.height - dragged.element.offsetHeight, top + velocityY * delta))}px`;
      }
      const decay = Math.exp(-delta / 260);
      velocityX *= decay;
      velocityY *= decay;
      if (Math.hypot(velocityX, velocityY) > 0.025) {
        window.requestAnimationFrame(coast);
      } else {
        dragged.element.getAnimations().forEach((animation) => animation.play());
      }
    };
    if (Math.hypot(velocityX, velocityY) > 0.025) window.requestAnimationFrame(coast);
    else dragged.element.getAnimations().forEach((animation) => animation.play());
  }

  function resetPromoSpotlight(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty("--pointer-x");
    event.currentTarget.style.removeProperty("--pointer-y");
  }

  const finishAuthentication = useCallback(async (accessToken: string, selectedBranch?: string) => {
    const result = await apiFetch<SessionExchangeResponse>("/api/auth/supabase-session", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken, ...(selectedBranch ? { branch: selectedBranch } : {}) }),
    });

    if (result.needs_branch) {
      setPendingAccessToken(accessToken);
      setStep("branch");
      return;
    }

    await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" });
    setPendingAccessToken(null);
    const user = await apiFetch<Me>("/api/me");
    if (user.role === "admin" && !user.admin_verified) setStep("admin");
    else router.push("/rooms", { transitionTypes: ["nav-forward"] });
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const authError = params.get("error_description") || hashParams.get("error_description");
    const isAuthCallback = params.has("code") || params.has("auth") || hashParams.has("access_token");

    if (authError) {
      const errorTimer = window.setTimeout(() => setError(authError.replaceAll("+", " ")), 0);
      window.history.replaceState(null, "", "/login");
      return () => window.clearTimeout(errorTimer);
    }
    if (!isAuthCallback || oauthHandled.current) return;

    oauthHandled.current = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const errorTimer = window.setTimeout(
        () => setError("Add your Supabase URL and publishable key to frontend/.env.local first."),
        0,
      );
      return () => window.clearTimeout(errorTimer);
    }

    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        window.history.replaceState(null, "", "/login");
        if (sessionError) throw sessionError;
        if (!data.session) {
          setNotice("Your sign-in session expired. Continue with Google to sign in again.");
          return;
        }
        await finishAuthentication(data.session.access_token);
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Could not finish sign-in");
      } finally {
        setBusy(false);
      }
    })();
  }, [finishAuthentication]);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Add your Supabase URL and publishable key to frontend/.env.local first.");
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not start Google sign-in");
      setBusy(false);
    }
  }

  async function finishBranchSelection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingAccessToken) {
      setError("Your sign-in expired. Please sign in again.");
      setStep("account");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await finishAuthentication(pendingAccessToken, branch);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not finish account setup");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/admin-totp", {
        method: "POST",
        body: JSON.stringify({ code: adminCode }),
      });
      router.push("/rooms", { transitionTypes: ["nav-forward"] });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Could not verify admin access");
    } finally {
      setBusy(false);
    }
  }

  async function goBack() {
    setError(null);
    setNotice(null);
    if (step === "account") {
      router.push("/", { transitionTypes: ["nav-back"] });
      return;
    }
    if (step === "branch") {
      await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" });
      setPendingAccessToken(null);
      setBranch("");
    }
    setStep("account");
  }

  const heading = step === "branch"
    ? "Choose your branch."
    : step === "admin"
      ? "One more check."
      : "Welcome to PaperCall.";
  const copy = step === "branch"
    ? "Choose a branch to finish setting up your account."
    : step === "admin"
      ? "Enter your admin second factor to continue."
      : "Continue with Google to create or access your account.";

  return (
    <PageTransition>
      <main className="grid min-h-screen grid-cols-[minmax(440px,.9fr)_1.1fr] bg-paper max-[900px]:grid-cols-1">
        <section className="flex min-h-screen flex-col border-r-2 border-ink px-[clamp(28px,5vw,80px)] py-7 max-[900px]:border-r-0">
          <Link
            className="inline-flex items-center gap-2.5 text-[1.08rem] font-black no-underline"
            href="/"
            transitionTypes={["nav-back"]}
          >
            <span className="grid size-9 place-items-center border-2 border-ink bg-acid text-ink shadow-[2px_2px_0_#111]">P</span>
            <BrandName />
          </Link>

          <div className="my-auto mx-auto w-full max-w-[576px] py-12">
            <TapedExamPaper>
            <button className="mb-12 flex items-center gap-2 border-0 bg-transparent p-0 font-bold text-ink-soft" onClick={goBack}>
              <ArrowLeft /> Back
            </button>
            <h1 className="mb-3 text-[clamp(2.5rem,5vw,4.2rem)] font-black leading-[.9] tracking-tight">{heading}</h1>
            <p className="max-w-[43ch] leading-7 text-ink-soft">{copy}</p>

            {step === "account" && (
              <button className={`${actionClass} mt-8 w-full`} type="button" onClick={signInWithGoogle} disabled={busy}>
                {busy ? "Opening Google…" : "Continue with Google"}
                {!busy && <ArrowRight />}
              </button>
            )}

            {step === "branch" && (
              <form className="mt-9 grid gap-[18px]" onSubmit={finishBranchSelection}>
                <label className="grid gap-2 text-sm font-bold">
                  Your branch
                  <select
                    className={controlClass}
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    disabled={!branchesLoaded || branches.length === 0}
                    required
                  >
                    <option value="">Choose branch</option>
                    {branches.map((item) => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
                {!branchesLoaded && <p className="m-0 text-sm text-ink-soft">Loading branches…</p>}
                {branchesLoaded && branches.length === 0 && (
                  <p className="m-0 text-sm text-danger">No branches are available. Ask an admin to add one.</p>
                )}
                <button className={actionClass} disabled={busy || !branchesLoaded || branches.length === 0}>
                  {busy ? "Creating account…" : <>Finish sign up <ArrowRight /></>}
                </button>
              </form>
            )}

            {step === "admin" && (
              <form className="mt-9 grid gap-[18px]" onSubmit={verifyAdmin}>
                <label className="grid gap-2 text-sm font-bold">
                  Admin access code
                  <input className={controlClass} inputMode="numeric" autoComplete="one-time-code" maxLength={64} value={adminCode} onChange={(event) => setAdminCode(event.target.value)} required />
                </label>
                <button className={actionClass} disabled={busy}>
                  {busy ? "Checking…" : <>Open admin room <ArrowRight /></>}
                </button>
              </form>
            )}

            {notice && <p className="mt-5 border-2 border-ink bg-acid/40 p-3 font-bold text-ink" role="status">{notice}</p>}
            {error && <p className="mt-5 border-2 border-ink bg-[#ffe4df] p-3 font-bold text-[#8f302d]" role="alert">{error}</p>}
            <p className="mt-8 font-mono text-xs text-ink-soft">Virtual points only. No cash value, no real-money wagering.</p>
            </TapedExamPaper>
          </div>
        </section>

        <aside
          ref={promoPanelRef}
          className="relative flex flex-col justify-between overflow-hidden bg-[#b9a0ff] p-[clamp(38px,6vw,90px)] text-ink max-[900px]:hidden"
          onPointerMove={updatePromoSpotlight}
          onPointerLeave={resetPromoSpotlight}
          onPointerDown={startPromoDrag}
          onPointerUp={endPromoDrag}
          onPointerCancel={endPromoDrag}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-25 [background-image:radial-gradient(#111_1px,transparent_1px)] [background-size:26px_26px] motion-reduce:hidden" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 motion-reduce:hidden"
            style={{ backgroundImage: "radial-gradient(circle 260px at var(--pointer-x, 50%) var(--pointer-y, 50%), rgba(216, 255, 98, 0.2), transparent)" }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] motion-reduce:hidden">
            <span data-arcade-float data-draggable className="pointer-events-auto absolute left-[14%] top-[43%] block size-11 cursor-grab touch-none text-acid">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="M24 3 29 18 45 18 32 27 37 43 24 33 11 43 16 27 3 18 19 18 24 3Z" fill="currentColor" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" />
              </svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute right-[14%] top-[39%] block size-10 cursor-grab touch-none text-[#ff719f]">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="m9 9 30 30M39 9 9 39" stroke="#111" strokeWidth="9" strokeLinecap="square" />
                <path d="m9 9 30 30M39 9 9 39" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
              </svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute bottom-[27%] left-[21%] block size-12 cursor-grab touch-none text-white">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="19" fill="currentColor" stroke="#111" strokeWidth="2.5" />
                <path d="M24 15v18M15 24h18" stroke="#111" strokeWidth="3" strokeLinecap="square" />
              </svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute bottom-[33%] right-[16%] block size-9 cursor-grab touch-none text-[#ff719f]">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M20 3v34M3 20h34M8 8l24 24M32 8 8 32" stroke="#111" strokeWidth="7" strokeLinecap="square" />
                <path d="M20 3v34M3 20h34M8 8l24 24M32 8 8 32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
              </svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute left-[48%] top-[27%] block size-8 cursor-grab touch-none text-[#3685ff]">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 3v34M3 20h34" stroke="#111" strokeWidth="8" strokeLinecap="square" /><path d="M20 3v34M3 20h34" stroke="currentColor" strokeWidth="4" strokeLinecap="square" /></svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute bottom-[17%] left-[47%] block size-10 cursor-grab touch-none text-[#ed7458]">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 3 29 18 45 18 32 27 37 43 24 33 11 43 16 27 3 18 19 18 24 3Z" fill="currentColor" stroke="#111" strokeWidth="2.5" strokeLinejoin="round" /></svg>
            </span>
            <span data-arcade-float data-draggable className="pointer-events-auto absolute right-[42%] top-[67%] block size-7 cursor-grab touch-none text-acid">
              <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m9 9 22 22m0-22L9 31" stroke="#111" strokeWidth="9" strokeLinecap="square" /><path d="m9 9 22 22m0-22L9 31" stroke="currentColor" strokeWidth="5" strokeLinecap="square" /></svg>
            </span>
          </div>
          <div className="relative z-10">
            <span className="font-mono text-xs font-extrabold uppercase tracking-widest">Tonight&apos;s call</span>
            <h2 aria-label={promoHeadline} className={`${minecraftBold.className} mt-3 max-w-[12ch] text-[clamp(2.25rem,4.4vw,4.8rem)] font-black leading-[.98] tracking-tight`}>
              <span aria-hidden="true">{typedHeadline}</span>
              {typedHeadline.length < promoHeadline.length && <span aria-hidden="true" className="ml-1 inline-block h-[0.78em] border-r-[0.12em] border-ink align-[-0.05em] motion-safe:animate-pulse" />}
            </h2>
          </div>
          <div data-draggable className="pointer-events-auto absolute left-[50%] top-[53%] z-10 w-[min(90%,480px)] cursor-grab touch-none rotate-1 border-2 border-ink bg-surface p-[30px] text-ink shadow-[7px_7px_0_#111]">
            <span className="text-xs font-extrabold uppercase text-ink-soft">COA · Midsem</span>
            <strong className="my-8 block text-[2.2rem] font-black leading-tight">Booth&apos;s algorithm</strong>
            <div className="flex justify-between border-t-2 border-ink pt-[18px]">
              <b className="border-2 border-ink bg-gradient-to-r from-[#3685ff] to-[#54f0b3] px-4 py-2">HIT</b>
              <i className="not-italic font-black">65 pts</i>
            </div>
          </div>
          <div data-draggable className="pointer-events-auto absolute left-[12%] top-[68%] z-10 w-[min(76%,360px)] cursor-grab touch-none -rotate-2 border-2 border-ink bg-surface p-6 text-ink shadow-[7px_7px_0_#111]">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">DAM · Midsem</span>
            <strong className="my-6 block text-[1.8rem] font-black leading-tight">Will walking-man show up?</strong>
            <div className="flex justify-between border-t-2 border-ink pt-4">
              <b className="border-2 border-ink bg-gradient-to-r from-[#ff9b32] to-[#ef45b5] px-4 py-2">MISS</b>
              <i className="not-italic font-black">40 pts</i>
            </div>
          </div>
          <p className="relative z-10 self-end text-right font-mono text-sm font-bold leading-7 text-ink-soft">Commit to the call.<br />Let the paper decide.</p>
        </aside>
      </main>
    </PageTransition>
  );
}