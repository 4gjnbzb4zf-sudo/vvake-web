import type { Metadata } from "next";
import { LanguageRedirect } from "@/components/LanguageRedirect";

export const metadata: Metadata = {
  title: "Health & safety · Santé et sécurité",
  alternates: { canonical: "/en/terms/", languages: { en: "/en/terms/", fr: "/fr/terms/", "x-default": "/en/terms/" } },
};

/** vvake.com/terms/ (the short URL the watch shows) sends visitors to the health & safety text in their language. */
export default function TermsRedirectPage() {
  return <LanguageRedirect path="terms/" />;
}
