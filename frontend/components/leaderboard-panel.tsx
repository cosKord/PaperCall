"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import type { LeaderboardRow } from "@/types/api";

function formatScore(score: number) {
  return `${score > 0 ? "+" : ""}${score.toLocaleString()} pts`;
}

export function LeaderboardPanel() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    apiFetch<LeaderboardRow[]>("/api/leaderboard?scope=season")
      .then((result) => {
        if (current) setRows(result);
      })
      .catch((requestError) => {
        if (!current) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load leaderboard",
        );
      });

    return () => {
      current = false;
    };
  }, []);

  return (
    <aside className="sticky top-6 w-full min-w-0 overflow-hidden border-2 border-ink bg-surface shadow-[6px_6px_0_#111] max-[1100px]:static">
      <header className="border-b-2 border-ink bg-[#b9a0ff] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-xl font-black uppercase tracking-tight">Leaderboard</h2>
          <span className="border-2 border-ink bg-white px-2 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wide text-ink">
            All time
          </span>
        </div>
        <p className="mb-0 mt-1 font-mono text-xs text-ink-soft">
          Net points from settled calls
        </p>
      </header>

      {error ? (
        <p className="m-0 p-5 text-sm font-bold text-danger" role="alert">
          {error}
        </p>
      ) : rows === null ? (
        <p className="m-0 p-5 text-sm text-ink-soft" role="status">
          Loading standings…
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 p-5 text-sm text-ink-soft">
          Standings will appear after the first settled call.
        </p>
      ) : (
        <ol
          className="m-0 max-h-[min(68vh,640px)] list-none divide-y-2 divide-ink overflow-y-auto p-0"
          aria-label="Player rankings"
        >
          {rows.map((row, index) => (
            <li
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 ${row.is_you ? "bg-acid/50" : ""}`}
              key={`${row.name}-${index}`}
            >
              <span className="border-2 border-ink bg-paper px-1.5 py-1 font-mono text-xs font-bold tabular-nums text-ink">
                #{index + 1}
              </span>
              <span className="min-w-0 break-words text-sm font-extrabold">
                {row.name}
                {row.is_you && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-violet">
                    You
                  </span>
                )}
              </span>
              <strong
                className={`whitespace-nowrap text-right text-sm tabular-nums ${row.score < 0 ? "text-danger" : "text-ink"}`}
              >
                {formatScore(row.score)}
              </strong>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
