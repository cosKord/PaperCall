export const BRANCHES = ["IT", "CSE", "AIDS", "CSBS", "MECH", "CCE"] as const;

export type Branch = (typeof BRANCHES)[number];

export function isBranch(value: string): value is Branch {
  return BRANCHES.includes(value as Branch);
}

export function displayName(email: string) {
  const localPart = email.split("@")[0] || "Player";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
