import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = { title: "404 · VVake", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <Logo />
        <h1 className="font-display text-4xl font-semibold">404</h1>
        <p className="text-muted">
          {en.notFound.body} <span lang="fr">{fr.notFound.body}</span>
        </p>
        <div className="flex gap-3">
          <Link href="/en/" className="rounded-xl bg-pulse px-5 py-2.5 font-display text-sm font-semibold text-ink">
            {en.notFound.cta}
          </Link>
          <Link href="/fr/" lang="fr" className="rounded-xl border border-line px-5 py-2.5 font-display text-sm font-semibold">
            {fr.notFound.cta}
          </Link>
        </div>
      </body>
    </html>
  );
}
