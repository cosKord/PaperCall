"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export function InteractiveSurface({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const [selected, setSelected] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const toggle = () => setSelected((value) => !value);
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !surfaceRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    surfaceRef.current.style.transform = `perspective(900px) rotateX(${y * -8}deg) rotateY(${x * 10}deg) translateY(-4px)`;
  };
  const resetTilt = () => {
    if (surfaceRef.current) surfaceRef.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <div
      ref={surfaceRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      className={`cursor-pointer transition-[transform,box-shadow] duration-200 ease-out hover:shadow-[0_12px_20px_-8px_rgba(17,17,17,0.35)] active:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#e19b26] ${selected ? "translate-y-0.5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
