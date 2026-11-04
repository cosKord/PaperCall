"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { BRANCHES } from "@/lib/branches";

export function useBranches() {
  const [branches, setBranches] = useState<string[]>([...BRANCHES]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    setBranches(await apiFetch<string[]>("/api/branches"));
    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh()
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { branches, refresh, loaded };
}
