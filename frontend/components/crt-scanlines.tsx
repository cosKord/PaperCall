"use client";

import { usePathname } from "next/navigation";

export function CrtScanlines() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return null;
  return <div className="crt-scanlines" aria-hidden="true" />;
}
