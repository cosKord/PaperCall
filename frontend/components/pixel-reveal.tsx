"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const pixels = Array.from({ length: 96 }, (_, index) => {
  const column = index % 12;
  const row = Math.floor(index / 12);
  const x = column - 5.5;
  const y = row - 3.5;
  return { index, x, y, distance: Math.hypot(x, y) };
});

export function PixelReveal() {
  const [revealing, setRevealing] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRevealing(true));
    const timeout = window.setTimeout(() => setVisible(false), 1150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`pixel-reveal ${revealing ? "pixel-reveal--open" : ""}`} aria-hidden="true">
      {pixels.map((pixel) => (
        <span
          key={pixel.index}
          style={{
            "--pixel": pixel.index,
            "--delay": `${Math.round(pixel.distance * 75)}ms`,
            "--x": pixel.x,
            "--y": pixel.y,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
