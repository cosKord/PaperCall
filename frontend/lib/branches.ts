export function displayName(email: string) {
  const localPart = email.split("@")[0] || "Player";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
