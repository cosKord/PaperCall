import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function LandingPage() {
  return (
    <main className="landing">
      <SiteHeader />
      <section className="hero">
        <p className="eyebrow">Points only · No cash value</p>
        <h1>Call the paper before it lands.</h1>
        <p>Make predictions about your exam, back them with virtual points, and compare results after settlement.</p>
        <div className="actions">
          <Link className="button" href="/login">Sign up</Link>
          <Link className="text-link" href="/rooms">Go to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
