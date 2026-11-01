import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="site-header">
        <Link className="brand" href="/">PaperCall</Link>
        <Link className="button secondary" href="/login">Login</Link>
      </header>
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
