"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The header logo: goes to the home page, and when you're already on it, back to the top
 * (a link to the page you're on wouldn't move otherwise).
 */
export function LogoLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-label="VVake"
      className="shrink-0"
      onClick={(e) => {
        if (pathname.replace(/\/?$/, "/") !== href) return;
        e.preventDefault();
        history.replaceState(null, "", href);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {children}
    </Link>
  );
}
