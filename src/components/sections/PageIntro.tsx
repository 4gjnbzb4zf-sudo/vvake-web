import { SignText } from "@/components/brand/SignText";
import { Container, Kicker } from "@/components/ui/Section";

/** Top of a deeper page: kicker, one-line title (the page's h1) and one sentence. */
export function PageIntro({ kicker, title, lead }: { kicker: string; title: string; lead: string }) {
  return (
    <header className="relative overflow-hidden border-b border-line/60 pt-16 pb-12 sm:pt-24 sm:pb-16">
      <div className="bg-voxel-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <Container className="relative">
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
          <SignText text={title} />
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{lead}</p>
      </Container>
    </header>
  );
}
