"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import type { Me } from "@/types/api";

export function SiteHeader() {
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    let current = true;
    apiFetch<Me>("/api/me")
      .then((response) => current && setUser(response))
      .catch(() => current && setUser(null));
    return () => { current = false; };
  }, []);

  return (
    <header className="site-header">
      <Link className="brand" href="/">PaperCall</Link>
      <nav className="nav-links" aria-label="Primary navigation">
        {user ? (
          <>
            <Link href="/rooms">Rooms</Link>
            <Link className="button secondary" href="/profile">Profile</Link>
          </>
        ) : (
          <Link className="button secondary" href="/login">Login</Link>
        )}
      </nav>
    </header>
  );
}
