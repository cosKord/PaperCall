"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

export function AuthGuard({ children }: { children: (user: Me) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    apiFetch<Me>("/api/me")
      .then((response) => {
        if (current) setUser(response);
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          router.replace("/login");
        } else {
          setError(
            "We couldn't check your session. Check your connection and try again.",
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [attempt, router]);

  if (loading)
    return (
      <p
        className="grid min-h-screen place-items-center p-6 text-center font-bold text-ink-soft"
        role="status"
      >
        Checking your session…
      </p>
    );
  if (error)
    return (
      <div
        className="grid min-h-screen place-items-center p-6 text-center"
        role="alert"
      >
        <div className="max-w-md border-2 border-ink bg-surface p-6 shadow-[5px_5px_0_#111]">
          <p className="mb-4 font-bold text-danger">{error}</p>
          <button
            className="min-h-11 border-2 border-ink bg-acid px-4 py-2.5 font-bold text-ink shadow-[3px_3px_0_#111]"
            onClick={() => {
              setError(null);
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  if (!user)
    return (
      <p
        className="grid min-h-screen place-items-center p-6 text-center font-bold text-ink-soft"
        role="status"
      >
        Taking you to login…
      </p>
    );
  return <>{children(user)}</>;
}
