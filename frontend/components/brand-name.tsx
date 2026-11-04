import { minecraftBold } from "@/lib/fonts";

export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      Paper<span className={minecraftBold.className}>Call</span>
    </span>
  );
}
