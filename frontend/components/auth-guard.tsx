"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

export function AuthGuard({ children }: { children: (user: Me) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    apiFetch<Me>("/api/me")
      .then((response) => {
        if (current) setUser(response);
      })
      .catch(() => {
        if (current) router.replace("/login");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [router]);

  if (loading) return <p role="status">Checking your session…</p>;
  if (!user) return <p role="status">Taking you to login…</p>;
  return <>{children(user)}</>;
}
