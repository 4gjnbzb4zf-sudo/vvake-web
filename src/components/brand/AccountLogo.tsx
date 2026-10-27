"use client";

import { useEffect, useState } from "react";
import { coachTierName, ownPlanTier } from "@/lib/coachPlus";
import { PLUS_EVENT, plusActive, storedPlusTier, storedPlusUntil } from "@/lib/plusPay";
import { Logo } from "./Logo";

/**
 * The site logo with the "+" (named after the plan: Coach Plus or Coach Premium) when the account signed in in this tab has Plus (vvake.com/rewards and /plus remember
 * its plusUntil with the session, src/lib/plusPay.ts). Without a signed-in Plus account it is the plain logo; the
 * static HTML is always the plain one, the badge appears once the page knows.
 */
export function AccountLogo({ className }: { className?: string }) {
  const [until, setUntil] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const read = () => {
      setUntil(storedPlusUntil());
      setTier(storedPlusTier());
      setNow(Date.now());
    };
    const id = window.setTimeout(read, 0);
    window.addEventListener(PLUS_EVENT, read);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(PLUS_EVENT, read);
    };
  }, []);
  // The badge's name is the account's plan: VVake Coach Premium for Premium, else VVake Coach Plus.
  return <Logo className={className} plus={now > 0 && plusActive(until, now)} plusLabel={coachTierName(ownPlanTier(tier))} />;
}
