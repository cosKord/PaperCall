import Link from "next/link";
import Image from "next/image";

import { BrandName } from "@/components/brand-name";
import { ArrowRight, Check, Coins } from "@/components/icons";
import { PageTransition } from "@/components/page-transition";
import { PoolDistribution } from "@/components/pool-distribution";
import { PayoutEstimate } from "@/components/payout-estimate";
import { PixelStarField } from "@/components/pixel-star-field";
import { RankIcon } from "@/components/rank-icons";
import { TicketSlipHero } from "@/components/hero-text-containers";
import { InteractiveSurface } from "@/components/interactive-surface";
import { SiteFooter } from "@/components/site-footer";

const examplePool = { hit: 120, miss: 80 };
const exampleStake = 40;

export default function LandingPage() {
  return (
    <PageTransition>
      <main id="top" className="min-h-screen overflow-hidden bg-paper">
        <header className="flex h-[72px] items-center justify-between border-b-2 border-ink px-[clamp(22px,5vw,74px)] max-sm:h-[64px]">
          <Link
            className="inline-flex items-center gap-2.5 text-[1.08rem] font-black tracking-tight no-underline"
            href="/"
          >
            <Image className="size-9 border-2 border-ink shadow-[2px_2px_0_#111]" src="/images/papercall-logo.png" alt="" width={36} height={36} priority />
            <BrandName />
          </Link>
          <Link
            className="inline-flex items-center gap-2 border-2 border-ink bg-white px-3.5 py-2.5 font-extrabold no-underline shadow-[3px_3px_0_#111] transition-transform hover:-translate-y-0.5"
            href="/login"
            transitionTypes={["nav-forward"]}
          >
            Log in <ArrowRight />
          </Link>
        </header>
        <section className="relative isolate grid min-h-[calc(100vh-72px)] grid-cols-[1fr_minmax(430px,.9fr)] items-center gap-[clamp(16px,2vw,32px)] px-[clamp(22px,5vw,74px)] py-[clamp(48px,8vw,108px)] max-[900px]:grid-cols-1 max-sm:pt-[58px]">
          <PixelStarField />
          <div className="relative z-10 w-fit max-w-full justify-self-end max-[900px]:justify-self-center">
            <TicketSlipHero>
              <p className="mb-2 text-[clamp(1.1rem,1.6vw,1.4rem)] font-bold">
                Feeling adventurous?
              </p>
              <h1 className="m-0 max-w-[10ch] text-[clamp(3.5rem,8vw,7.4rem)] font-black leading-[.86] tracking-[-.06em] max-sm:text-[clamp(3.5rem,18vw,5.5rem)]">
                Luck is in the air.
              </h1>
              <div className="my-8 max-w-[620px] border-t-2 border-ink pt-3 font-mono text-sm font-bold uppercase tracking-wide text-ink-soft">
                Virtual points. Real bragging rights.
              </div>
              <Link
                className="inline-flex items-center justify-center gap-2.5 border-2 border-ink bg-coral px-[18px] py-[13px] font-extrabold text-ink no-underline shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-0.5"
                href="/login"
                transitionTypes={["nav-forward"]}
              >
                Make your first call <ArrowRight />
              </Link>
            </TicketSlipHero>
          </div>
          <InteractiveSurface label="Example exam prediction card" className="w-full max-w-[780px] justify-self-start max-[900px]:justify-self-center">
          <div
            className="landing-hero-art relative z-10 grid min-h-[520px] w-full place-items-center border-2 border-ink bg-[#b9a0ff] shadow-[8px_8px_0_#111] -rotate-0 max-sm:min-h-[390px] max-sm:rotate-0"
            aria-label="An example exam prediction"
          >
            <span className="landing-hero-halftone" aria-hidden="true" />
            <div className="absolute left-[2%] top-[13%] z-10 border-2 border-ink bg-acid px-4 py-2.5 font-mono font-black text-ink shadow-[3px_3px_0_#111]">
              DBMS
            </div>
            <div className="absolute bottom-[18%] right-0 z-10 border-2 border-ink bg-white px-4 py-2.5 font-mono font-black text-ink shadow-[3px_3px_0_#111]">
              +240 pts
            </div>
            <div className="relative z-[1] w-[min(76%,500px)] rotate-2 border-2 border-ink bg-surface p-7 text-ink shadow-[7px_7px_0_#111] max-sm:w-[84%] max-sm:p-5">
              <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-ink-soft">
                <span>Tomorrow · 10:30 AM</span>
                <strong className="border-2 border-ink bg-[#b9a0ff] px-2 py-1.5 text-ink">
                  Midsem
                </strong>
              </div>
              <h2 className="my-10 text-[clamp(1.8rem,3vw,2.7rem)] font-black leading-none tracking-tight">
                Will normalization appear?
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <span className="flex items-center justify-center gap-1.5 border-2 border-ink bg-gradient-to-r from-[#3685ff] to-[#54f0b3] p-3 text-center font-extrabold">
                  <Check /> Hit
                </span>
                <span className="border-2 border-ink bg-gradient-to-r from-[#ff9b32] to-[#ef45b5] p-3 text-center font-extrabold">
                  Miss
                </span>
              </div>
              <div className="mt-7 flex items-center gap-3 border-t border-dashed border-[#aaa99f] pt-[18px]">
                <Coins />
                <span className="mr-auto text-ink-soft">Your call</span>
                <strong>40 pts</strong>
              </div>
            </div>
          </div>
          </InteractiveSurface>
        </section>
        <div
          className="flex min-w-max gap-14 border-y border-[#a9c94b] bg-acid px-8 py-4 font-black tracking-wider -rotate-1"
          aria-hidden="true"
        >
          <span>CALL IT BEFORE THE PAPER DROPS</span>
          <span>HIT OR MISS</span>
          <span>WATCH THE POOL MOVE</span>
          <span>ACTUALLY GOTTA OPEN THE SYLLABUS!</span>
          <span>AAAAAAAAAAAAAAAA</span>
        </div>
        <section className="mx-auto grid max-w-[1220px] grid-cols-[1.1fr_.9fr] items-center gap-[clamp(48px,9vw,130px)] px-[clamp(22px,5vw,64px)] py-[clamp(90px,12vw,170px)] max-[900px]:grid-cols-1">
          <InteractiveSurface label="Branch room card" className="w-full">
          <div className="min-h-[430px] -rotate-1 border-2 border-ink bg-violet p-[34px] text-ink shadow-[7px_7px_0_#111]">
            <div className="mb-12 text-[2.4rem] font-black tracking-tight">
              Room: IT
            </div>
            {["Database systems", "Computer networks", "Data structures"].map(
              (subject, index) => (
                <div
                  className="mt-3 flex items-center justify-between gap-5 border-2 border-ink bg-white p-5 shadow-[3px_3px_0_#111]"
                  key={subject}
                >
                  <span>{subject}</span>
                  <strong className="font-mono text-xs uppercase text-[#3c3565]">
                    {index + 3} markets
                  </strong>
                </div>
              ),
            )}
          </div>
          </InteractiveSurface>
          <div>
            <h2 className="mb-6 text-[clamp(2.3rem,5vw,4.4rem)] font-black leading-[.95] tracking-tight">
              Walk into your branch room.
            </h2>
            <p className="max-w-[48ch] text-[1.08rem] leading-7 text-ink-soft">
              Step onto your branch floor. Track live markets for your syllabus,
              call which topics will appear before the paper drops, and see
              where your batchmates are putting their points.
            </p>
          </div>
        </section>
        <section id="how-calls-work" className="border-y-2 border-ink bg-white px-[clamp(22px,5vw,74px)] py-[clamp(64px,9vw,120px)]">
          <div className="mx-auto grid max-w-[1220px] grid-cols-[.9fr_1.1fr] items-center gap-[clamp(36px,7vw,96px)] max-[900px]:grid-cols-1">
            <div>
              <p className="mb-3 font-mono text-xs font-extrabold uppercase tracking-[.18em] text-ink-soft">
                How calls work
              </p>
              <h2 className="mb-5 max-w-[12ch] text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[.95] tracking-tight">
                Follow the pool. Size your call.
              </h2>
              <p className="mb-0 max-w-[55ch] text-[1.05rem] leading-7 text-ink-soft">
                Points from Hit and Miss calls form a shared pool. If your side
                wins, its callers split the pool in proportion to their calls.
                The estimate includes your proposed points and moves as the
                pool changes, until calls lock. 
                Still working on this, suggestions are welcome.
              </p>
            </div>
            <InteractiveSurface label="Example pool and payout card" className="w-full">
            <div className="grid rotate-1 gap-4 border-2 border-ink bg-paper p-[clamp(18px,3vw,28px)] shadow-[6px_6px_0_#111] max-[900px]:rotate-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-3">
                <h3 className="m-0 text-lg font-black">Example: 40 points on Hit</h3>
                <span className="font-mono text-xs font-bold uppercase text-ink-soft">Illustrative</span>
              </div>
              <PoolDistribution pool={examplePool} isExample />
              <PayoutEstimate
                pool={examplePool}
                side="hit"
                stake={exampleStake}
                isExample
              />
            </div>
            </InteractiveSurface>
          </div>
          <article className="mx-auto mt-8 grid max-w-[1220px] gap-4 border-2 border-ink bg-[#e9e3ff] p-[clamp(18px,3vw,28px)] shadow-[5px_5px_0_#111] sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h3 className="mb-3 mt-0 text-3xl font-black">Build XP. Rank up. Insane aura points.</h3>
              <p className="mb-0 max-w-[62ch] leading-relaxed text-ink-soft">
                Every call adds to your progress. Level up through Newbie, Risk enjoyer, Gamblers spirit, Prophet, and Oracle as your prediction record grows.
              </p>
            </div>
            <div className="flex items-center gap-2" aria-label="Five XP ranks">
              {[0, 1, 2, 3, 4].map((level) => (
                <RankIcon key={level} level={level} className="size-10 p-2 shadow-[2px_2px_0_#111]" />
              ))}
            </div>
          </article>
        </section>
        <SiteFooter />
      </main>
    </PageTransition>
  );
}
