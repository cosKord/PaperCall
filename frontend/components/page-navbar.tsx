import Link from "next/link";

import { ArrowLeft } from "@/components/icons";

export function PageNavbar({ href = "/rooms", label = "All rooms" }: { href?: string; label?: string }) {
  return (
    <nav aria-label="Page navigation" className="mx-auto w-[min(1080px,calc(100%-40px))]">
      <Link className="inline-flex items-center gap-2 font-bold text-ink-soft no-underline transition hover:text-ink" href={href} transitionTypes={["nav-back"]}>
        <ArrowLeft /> {label}
      </Link>
    </nav>
  );
}
