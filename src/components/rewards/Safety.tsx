import type { ReactNode } from "react";
import { Container } from "@/components/ui/Section";
import { format, type Dictionary } from "@/i18n/dictionaries";
import { rewardsConfig, shortHex } from "@/lib/rewards-config";

type Dict = Dictionary["rewards"];

/**
 * Clickjacking guard (VV-12): the children only show when <html data-unframed> is set by FRAME_GUARD_SCRIPT (top
 * window). Inside a frame, the notice shows instead, with a link that opens the page on its own.
 */
export function FrameGuard({ dict, href, children }: { dict: Dict["framed"]; href: string; children?: ReactNode }) {
  return (
    <>
      <div data-frame-notice="" role="alert" className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="font-display text-2xl font-semibold">{dict.title}</p>
        <p className="mt-3 text-muted">{dict.body}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block font-mono text-pulse-fg underline underline-offset-4"
        >
          {dict.link}
        </a>
      </div>
      <div data-frame-guard="">{children}</div>
    </>
  );
}

/** The anti-scam banner of the rewards page: what VVake never does, and what a real claim looks like. */
export function ScamWarning({ dict, contract = rewardsConfig.rewardsContract }: { dict: Dict["scam"]; contract?: string }) {
  return (
    <Container>
      <div role="note" className="mb-8 rounded-xl border border-down-fg/40 bg-down-fg/5 px-4 py-3 text-sm">
        <p className="font-display font-semibold text-down-fg">{dict.title}</p>
        <p className="mt-1 text-muted">{format(dict.body, { contract: shortHex(contract) })}</p>
      </div>
    </Container>
  );
}
