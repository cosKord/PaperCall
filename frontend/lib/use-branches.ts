"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

export function useBranches() {
  const [branches, setBranches] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const nextBranches = await apiFetch<string[]>("/api/branches");
      setBranches(nextBranches);
      return nextBranches;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiFetch<string[]>("/api/branches")
      .then((nextBranches) => {
        if (!active) return;
        setBranches(nextBranches);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return { branches, refresh, loaded };
}
