import { minecraftBold } from "@/lib/fonts";
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      <span className={minecraftBold.className}>PaperCall</span>
    </span>
  );
}