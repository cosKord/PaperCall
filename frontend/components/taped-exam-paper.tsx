import type { ReactNode } from "react";

export function TapedExamPaper({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative border-2 border-ink bg-[repeating-linear-gradient(to_bottom,#fff_0,#fff_31px,#dbe9f2_32px)] p-[clamp(28px,4vw,48px)] pl-[clamp(62px,9vw,88px)] shadow-[8px_8px_0_#111] ${className}`}>
      <span
        aria-hidden="true"
        className="absolute -top-4 left-[14%] h-9 w-28 -rotate-3 border border-[#b89b4e]/60 bg-[#f4da87]/85 shadow-sm"
      />
      <span aria-hidden="true" className="absolute bottom-0 left-[42px] top-0 w-px bg-[#d95656]" />
      <div className="relative">
        <header className="border-b-2 border-ink pb-4 font-mono text-[10px] font-bold uppercase tracking-[.12em] text-ink-soft">
          <div className="flex items-start justify-between gap-4">
            <p className="m-0 text-ink">PaperCall examination sheet</p>
            <span className="grid size-9 shrink-0 -rotate-6 place-items-center rounded-full border-2 border-[#d95656] font-sans text-xs font-black tracking-normal text-[#bd3c3c]">A+</span>
          </div>
          <div className="mt-3 grid gap-1.5 text-[9px] sm:grid-cols-2 sm:gap-x-6">
            <span>Name: Chupapi Munyayo</span>
            <span>Roll no: 80085</span>
            <span>Date: 6/7/69</span>
          </div>
        </header>
        <div className="pt-8">{children}</div>
      </div>
    </section>
  );
}
