import type { SVGProps } from "react";

const ranks = [
  { name: "Newbie", color: "#64748B", background: "#EAE7DF", icon: <path d="M12 20v-7m0 3c-4 0-6-2-6-5 4 0 6 2 6 5Zm0-2c0-4 2-7 7-8 0 4-2 7-7 8Z" /> },
  { name: "Risk-enjoyer", color: "#2878B8", background: "#E5F1FF", icon: <><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="8" cy="8" r=".8" /><circle cx="16" cy="8" r=".8" /><circle cx="12" cy="12" r=".8" /><circle cx="8" cy="16" r=".8" /><circle cx="16" cy="16" r=".8" /></> },
  { name: "Gamblers spirit", color: "#D97736", background: "#FFF0E3", icon: <path d="M13 3c1 5-4 5-2 9 1-1 2-2 2-3 4 3 5 6 3 10a6 6 0 0 1-12-2c0-3 2-5 4-7 0 3 1 4 2 4-1-5 1-8 3-11Z" /> },
  { name: "Prophet", color: "#8B78E6", background: "#EEE9FF", icon: <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></> },
  { name: "Oracle", color: "#D9FF68", background: "#20233D", icon: <><path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Z" /><path d="M7 22h10" /></> },
];

export function RankIcon({ level, className = "" }: { level: number; className?: string }) {
  const rank = ranks[Math.max(0, Math.min(4, level))];
  const props: SVGProps<SVGSVGElement> = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  return <span className={`inline-grid shrink-0 place-items-center rounded-md border-2 ${className}`} style={{ color: rank.color, backgroundColor: rank.background, borderColor: rank.color }} title={rank.name}><svg {...props}>{rank.icon}</svg><span className="sr-only">{rank.name}</span></span>;
}

export function rankName(level: number) {
  return ranks[Math.max(0, Math.min(4, level))].name;
}
