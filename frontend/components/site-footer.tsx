import Link from "next/link";

import { BrandName } from "@/components/brand-name";
import { minecraftBold } from "@/lib/fonts";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#101010] px-[clamp(22px,5vw,74px)] py-10 font-mono text-[13px] font-bold uppercase tracking-[.12em] text-[#e8e5dc]">
      <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr_1fr] gap-8 pb-9 max-[1000px]:grid-cols-3 max-[700px]:grid-cols-2 max-sm:grid-cols-1">
        <div className="grid content-start gap-2">
          <strong className="tracking-[.16em]"><BrandName /></strong>
          <span className="text-[#aaa9a2]">© 2026 · Virtual points only</span>
        </div>
        <nav aria-label="Legal" className="grid content-start justify-items-start gap-2">
          <h2 className="m-0 mb-1 text-[14px] tracking-[.18em] text-[#888780]">Legal</h2>
          <Link className="text-inherit no-underline hover:text-acid" href="/privacy-policy">Privacy policy</Link>
          <Link className="text-inherit no-underline hover:text-acid" href="/website-terms">Website terms</Link>
        </nav>
        <nav aria-label="Links" className="grid content-start justify-items-start gap-2">
          <h2 className="m-0 mb-1 text-[14px] tracking-[.18em] text-[#888780]">Links</h2>
          <a className="text-inherit no-underline hover:text-acid" href="https://github.com/" rel="noreferrer" target="_blank">GitHub</a>
        </nav>
        <div className="grid content-start justify-items-start gap-2">
          <h2 className="m-0 mb-1 text-[14px] tracking-[.18em] text-[#888780]">Contact</h2>
          <a className="text-inherit normal-case tracking-normal no-underline hover:text-acid" href="mailto:dnyanitbhusari21@gmail.com">dnyanitbhusari21@gmail.com</a>
        </div>
        <nav aria-label="Support" className="grid content-start justify-items-start gap-2">
          <h2 className="m-0 mb-1 text-[14px] tracking-[.18em] text-[#888780]">Support</h2>
          <a className="text-inherit no-underline hover:text-acid" href="/#how-calls-work">FAQ</a>
          <a className="text-inherit no-underline hover:text-acid" href="mailto:dnyanitbhusari21@gmail.com?subject=PaperCall%20problem%20report">Report a problem</a>
          <a className="text-inherit no-underline hover:text-acid" href="mailto:dnyanitbhusari21@gmail.com?subject=PaperCall%20feedback">Feedback</a>
        </nav>
      </div>
      <div className="flex justify-end border-t border-[#3a3a38] pt-4">
        <a className="text-[10px] tracking-[.16em] text-[#aaa9a2] no-underline hover:text-white" href="/#top">
          Back to top ↑
        </a>
      </div>
      <div aria-hidden="true" className="mt-24 h-[clamp(64px,9.6vw,184px)] overflow-hidden max-sm:mt-16">
        <p
          className={`${minecraftBold.className} m-0 whitespace-nowrap text-center text-[clamp(5rem,15vw,18rem)] leading-[.8] tracking-[-.06em] text-[#e8e5dc]`}
        >
          PAPERCALL
        </p>
      </div>
    </footer>
  );
}
