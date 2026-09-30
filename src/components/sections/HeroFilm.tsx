"use client";

import { useRef, useState } from "react";
import { Container } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";

/** The brand film right under the hero: muted autoplay loop (as browsers require), one tap for sound. */
export function HeroFilm({ dict }: { dict: Dictionary["hero"] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted) void v.play();
    setMuted(v.muted);
  };

  return (
    <section aria-label={dict.film} className="relative py-10 sm:py-16">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-line bg-night-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)]">
          <video
            ref={video}
            className="block aspect-video w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/film/vvake-film-poster.webp"
            aria-label={dict.film}
          >
            <source src="/film/vvake-film-540.mp4" type="video/mp4" media="(max-width: 767px)" />
            <source src="/film/vvake-film-720.mp4" type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={!muted}
            className="absolute top-3 right-3 rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] tracking-[0.12em] text-text uppercase backdrop-blur transition-colors hover:bg-ink/90 sm:top-5 sm:right-5 sm:px-4 sm:py-2 sm:text-xs"
          >
            {muted ? `🔈 ${dict.soundOn}` : `🔊 ${dict.soundOff}`}
          </button>
        </div>
      </Container>
    </section>
  );
}
