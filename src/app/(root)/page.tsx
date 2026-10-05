import { LanguageRedirect } from "@/components/LanguageRedirect";

/** "/" only routes visitors to their language (see LanguageRedirect). */
export default function RootPage() {
  return <LanguageRedirect />;
}
