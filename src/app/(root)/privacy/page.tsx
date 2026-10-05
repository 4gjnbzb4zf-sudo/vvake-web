import type { Metadata } from "next";
import { LanguageRedirect } from "@/components/LanguageRedirect";

export const metadata: Metadata = {
  title: "Privacy policy · Politique de confidentialité",
  alternates: { canonical: "/en/privacy/", languages: { en: "/en/privacy/", fr: "/fr/privacy/", "x-default": "/en/privacy/" } },
};

/** vvake.com/privacy/ (the short URL for the App Store) sends visitors to the policy in their language. */
export default function PrivacyRedirectPage() {
  return <LanguageRedirect path="privacy/" />;
}
