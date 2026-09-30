import { Fragment } from "react";
import { LogoMark } from "./Logo";

/**
 * Display text with the sign as the W of the brand: every "VVake…" is written [hand]ake… (VVaker, VVake up…).
 * The hand is sized to the text (a little taller than the capitals); screen readers and search still get "VV".
 */
export function SignText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(VVak\w*)/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("VVak") ? (
          <span key={i} className={`inline-flex items-baseline whitespace-nowrap ${className ?? ""}`}>
            <span className="sr-only">VV</span>
            <LogoMark className="mr-[0.02em] h-[1.02em] translate-y-[0.1em] self-baseline text-current" />
            <span>{part.slice(2)}</span>
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
