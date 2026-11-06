import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PixelReveal } from "@/components/pixel-reveal";
import { CrtScanlines } from "@/components/crt-scanlines";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperCall",
  description: "Points-only exam prediction rooms",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode; }>) {
  return (
    <html lang="en">
      <body><PixelReveal /><CrtScanlines />{children}</body>
    </html>
  );
}
