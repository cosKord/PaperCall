import { ViewTransition } from "react";
import type { ReactNode } from "react";

const routeMotion = {
  "nav-forward": "paper-call-forward",
  "nav-back": "paper-call-back",
  default: "paper-call-neutral",
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="none" enter={routeMotion} exit={routeMotion}>
      {children}
    </ViewTransition>
  );
}
