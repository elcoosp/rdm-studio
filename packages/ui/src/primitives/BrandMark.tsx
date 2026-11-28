import { cn } from "../lib/cn";

/**
 * BrandMark — the official RDM Studio lockup using `/logo-rdm-studio.png`.
 */
export function BrandMark({
  size = "sm",
  showTagline = false,
  className,
  wordmarkClassName,
}: {
  size?: "sm" | "md";
  showTagline?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2", className)}>
      <img src="/logo-rdm-studio.png" alt="RDM Studio" className={cn(dim, "shrink-0 object-contain")} />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-tight text-ink-primary",
            size === "sm" ? "text-[15px]" : "text-base",
            wordmarkClassName,
          )}
        >
          RDM Studio
        </span>
        {showTagline ? (
          <span className="mt-1 text-[12px] leading-4 text-ink-secondary">
            Atelier de calcul de structures 3D
          </span>
        ) : null}
      </span>
    </span>
  );
}
