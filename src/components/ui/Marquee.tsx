import { cn } from "@/lib/cn";

interface MarqueeProps {
  items: readonly string[];
  className?: string;
  reverse?: boolean;
  separator?: string;
}

/**
 * Infinite ticker. The list is rendered twice and translated by -50%, so the loop is seamless.
 * Decorative (aria-hidden): the same content exists elsewhere on the page. Stops under reduced motion.
 */
export function Marquee({ items, className, reverse = false, separator = "✦" }: MarqueeProps) {
  const row = items.flatMap((item) => [item, separator]);
  return (
    <div className={cn("overflow-hidden whitespace-nowrap select-none", className)} aria-hidden="true">
      <div className={cn("flex w-max animate-marquee gap-6", reverse && "[animation-direction:reverse]")}>
        {[...row, ...row].map((item, i) => (
          <span key={i} className={item === separator ? "opacity-60" : undefined}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
