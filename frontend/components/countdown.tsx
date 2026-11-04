"use client";

import { useEffect, useState } from "react";

function remainingLabel(milliseconds: number) {
  if (milliseconds <= 0) return "Locked";
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m ${remainder}s`;
}

export function Countdown({
  target,
  serverNow,
}: {
  target: string;
  serverNow: string;
}) {
  const [remaining, setRemaining] = useState(
    () => Date.parse(target) - Date.parse(serverNow),
  );

  useEffect(() => {
    const startedAt = Date.now();
    const initial = Date.parse(target) - Date.parse(serverNow);
    const update = () => setRemaining(initial - (Date.now() - startedAt));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [serverNow, target]);

  return (
    <span aria-label="Time until calls lock">{remainingLabel(remaining)}</span>
  );
}
