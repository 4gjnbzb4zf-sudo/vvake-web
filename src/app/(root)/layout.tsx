import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "VVake",
  robots: { index: false, follow: true },
  alternates: { languages: { en: "/en/", fr: "/fr/", "x-default": "/en/" } },
};

/** Minimal root for "/", which only routes visitors to their language. */
export default function RootRedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
