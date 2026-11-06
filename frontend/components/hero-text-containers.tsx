import type { ReactNode } from "react";

type ContainerProps = { children: ReactNode };

export function TicketSlipHero({ children }: ContainerProps) {
  return (
    <div className="-rotate-1" style={{ filter: "drop-shadow(10px 14px 12px rgba(17, 17, 17, 0.38))" }}>
    <div className="relative isolate min-h-[620px] border-2 border-ink bg-[#fffdf2] px-[clamp(30px,4vw,54px)] pb-[clamp(28px,4vw,44px)] pt-10 text-ink [clip-path:polygon(0_0,100%_0,100%_18%,96%_21%,100%_24%,100%_46%,96%_50%,100%_54%,100%_76%,96%_80%,100%_84%,100%_100%,0_100%,0_84%,4%_80%,0_76%,0_54%,4%_50%,0_46%,0_24%,4%_21%,0_18%)] max-sm:min-h-[560px] max-sm:px-7">
      <div className="mb-6 flex items-center justify-between border-b-2 border-dashed border-[#9b978b] pb-3 font-mono text-[11px] font-black uppercase tracking-[.15em] text-[#55534e]">
        <span>ADMIT ONE CALL</span><span>NO. 001</span>
      </div>
      {children}
      <div aria-hidden="true" className="absolute inset-x-[clamp(30px,4vw,54px)] bottom-7 flex h-7 items-stretch justify-between border-t border-[#aaa99f] pt-2 max-sm:inset-x-7">
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#55534e]">PAPERCALL · EXAM ENTRY</span>
        <span className="flex h-5 items-stretch gap-[3px]">
          {[2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1].map((width, index) => <i key={index} className="bg-ink" style={{ width }} />)}
        </span>
      </div>
    </div>
    </div>
  );
}
