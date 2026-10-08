import Image from "next/image";
import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * The real app on iPhone and Apple Watch Ultra: two looping reels, then the screens one by one. `more` (the home
 * page) shows the reels only, with a link to every screen on /app.
 */
export function AppScreens({ dict, index, more }: { dict: Dictionary["screens"]; index?: string; more?: { href: string; label: string } }) {
  return (
    <Section
      id="screens"
      index={index}
      kicker={dict.kicker}
      title={dict.title}
      lead={dict.lead}
      layout={more ? "split" : "stack"}
      className="overflow-hidden"
    >
      <div className="mt-12 flex flex-wrap items-end justify-center gap-8 sm:gap-14">
        <figure className="flex flex-col items-center gap-3">
          {/* iPhone: a black bezel with rounded corners around the reel. */}
          <div className="w-[240px] rounded-[44px] border-[7px] border-[#1c1f24] bg-black p-1 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] sm:w-[280px]">
            <video
              className="block aspect-[830/1800] w-full rounded-[36px] object-cover"
              src="/app/phone-reel.mp4"
              poster="/app/phone-02-home.webp"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={dict.phoneLabel}
            />
          </div>
          <figcaption className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.phoneLabel}</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-3">
          {/* Apple Watch Ultra: a titanium-grey case and a hint of the crown. */}
          <div className="relative">
            <div className="w-[190px] rounded-[54px] border-[9px] border-[#8a8f96] bg-black p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] sm:w-[220px]">
              <video
                className="block aspect-[790/960] w-full rounded-[40px] object-cover"
                src="/app/watch-reel.mp4"
                poster="/app/watch-1-today.webp"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={dict.watchLabel}
              />
            </div>
            <span aria-hidden="true" className="absolute top-[30%] -right-2 h-12 w-3 rounded-r-md bg-[#f26b1d]" />
          </div>
          <figcaption className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.watchLabel}</figcaption>
        </figure>
      </div>

      {more ? (
        <p className="mt-10 text-center">
          <span className="block text-xs text-faint">{dict.note}</span>
          <a
            href={more.href}
            className="mt-4 inline-block font-display font-semibold text-pulse-fg underline decoration-pulse-fg/40 underline-offset-4 hover:decoration-pulse-fg"
          >
            {more.label} <span aria-hidden="true">→</span>
          </a>
        </p>
      ) : (
        <AllScreens dict={dict} />
      )}
    </Section>
  );
}

function AllScreens({ dict }: { dict: Dictionary["screens"] }) {
  return (
    <>
      {/* Every screen, swipe sideways on a phone. */}
      <ul className="-mx-4 mt-14 flex snap-x snap-mandatory [scrollbar-width:thin] gap-4 overflow-x-auto px-4 pb-4">
        {dict.phone.map((s) => (
          <li key={s.src} className="w-[200px] shrink-0 snap-start sm:w-[220px]">
            <Image
              src={`/app/${s.src}.webp`}
              width={600}
              height={1301}
              alt={`${s.title}: ${s.body}`}
              loading="lazy"
              className="w-full rounded-[28px] border border-line"
            />
            <p className="mt-3 font-display font-semibold">{s.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted">{s.body}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {dict.watch.map((s) => (
          <li key={s.src}>
            <Image
              src={`/app/${s.src}.webp`}
              width={400}
              height={487}
              alt={`${s.title}: ${s.body}`}
              loading="lazy"
              className="w-full rounded-[32px] border border-line"
            />
            <p className="mt-3 font-display font-semibold">{s.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted">{s.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-faint">{dict.note}</p>
    </>
  );
}
