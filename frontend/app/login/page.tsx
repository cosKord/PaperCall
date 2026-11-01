"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import type { AuthResponse, Me } from "@/types/api";

type Step = "email" | "code" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch<AuthResponse>("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDemoCode(response.demo_code ?? null);
      setStep("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch<AuthResponse>("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      const user = await apiFetch<Me>("/api/me");
      if (user.role === "admin" && !user.admin_verified) {
        setStep("admin");
      } else {
        router.push("/rooms");
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Could not verify code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAdmin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch<AuthResponse>("/api/auth/admin-totp", {
        method: "POST",
        body: JSON.stringify({ code: adminCode }),
      });
      router.push("/rooms");
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Could not verify admin access");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell narrow">
      <Link className="brand" href="/">PaperCall</Link>
      <section className="panel auth-panel">
        <p className="eyebrow">Somaiya access</p>
        <h1>{step === "admin" ? "Admin verification" : "Login or sign up"}</h1>
        <p>Your account is created automatically after your college email is verified.</p>

        {step === "email" && (
          <form onSubmit={requestCode} className="stack">
            <label htmlFor="email">College email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@somaiya.edu" required />
            <button className="button" disabled={busy}>Send login code</button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="stack">
            <p>Code sent to <strong>{email}</strong>.</p>
            {demoCode && <p className="notice">Local demo code: <strong>{demoCode}</strong></p>}
            <label htmlFor="login-code">Login code</label>
            <input id="login-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
            <button className="button" disabled={busy}>Verify code</button>
            <button type="button" className="text-button" onClick={() => setStep("email")}>Use a different email</button>
          </form>
        )}

        {step === "admin" && (
          <form onSubmit={verifyAdmin} className="stack">
            <label htmlFor="admin-code">Admin access code</label>
            <input id="admin-code" inputMode="numeric" value={adminCode} onChange={(event) => setAdminCode(event.target.value)} required />
            <button className="button" disabled={busy}>Verify admin</button>
          </form>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
