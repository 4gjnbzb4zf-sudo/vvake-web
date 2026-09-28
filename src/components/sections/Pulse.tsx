import { InView } from "@/components/ui/InView";
import { Section } from "@/components/ui/Section";
import type { Dictionary } from "@/i18n/dictionaries";
import { MyPulse } from "./MyPulse";

export function Pulse({ dict, index }: { dict: Dictionary["pulse"]; index: string }) {
  return (
    <Section id="pulse" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body}>
      <div className="mt-14 overflow-hidden rounded-3xl border border-line bg-surface/50">
        <InView>
          <PulseChart />
        </InView>
        <div className="grid border-t border-line sm:grid-cols-2">
          <PulseCard tone="down" tag={dict.rally.tag} title={dict.rally.title} body={dict.rally.body} ticker="LULU −4.1%" />
          <PulseCard tone="up" tag={dict.recover.tag} title={dict.recover.title} body={dict.recover.body} ticker="NKE +3.0%" />
        </div>
      </div>
      <MyPulse dict={dict.mine} />
      <p className="mt-4 text-sm text-faint">{dict.disclaimer}</p>
    </Section>
  );
}

function PulseCard(props: { tone: "up" | "down"; tag: string; title: string; body: string; ticker: string }) {
  const color = props.tone === "down" ? "text-down" : "text-up";
  return (
    <div className="p-7 first:border-b first:border-line sm:first:border-r sm:first:border-b-0">
      <div className="flex items-center justify-between">
        <span className={`font-mono text-xs tracking-[0.18em] uppercase ${color}`}>{props.tag}</span>
        <span className={`rounded-md border border-line bg-night px-2 py-1 font-mono text-xs ${color}`}>{props.ticker}</span>
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold">{props.title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{props.body}</p>
    </div>
  );
}

const CANDLES = Array.from({ length: 11 }, (_, i) => {
  const x = 30 + i * 30;
  const falling = i % 3 !== 1;
  const top = 70 + ((i * 37) % 50) + i * 4;
  const height = 24 + ((i * 13) % 30);
  return { x, top, height, falling };
});

/** Candlesticks on the left turn into a live heartbeat on the right. */
function PulseChart() {
  return (
    <svg viewBox="0 0 960 240" className="block h-auto w-full" role="img" aria-label="Market candles turning into a heartbeat line">
      <defs>
        <linearGradient id="pulse-fade" x1="0" x2="1">
          <stop offset="0" stopColor="#ccff00" stopOpacity="0" />
          <stop offset="0.25" stopColor="#ccff00" />
          <stop offset="1" stopColor="#ff3d6e" />
        </linearGradient>
      </defs>
      <g opacity="0.8">
        {CANDLES.map((c) => (
          <g key={c.x} opacity={1 - c.x / 420}>
            <path d={`M${c.x + 8} ${c.top - 12} V${c.top + c.height + 12}`} stroke={c.falling ? "#e07856" : "#5bd08a"} strokeWidth="2" />
            <rect x={c.x} y={c.top} width="16" height={c.height} rx="2" fill={c.falling ? "#e07856" : "#5bd08a"} />
          </g>
        ))}
      </g>
      <path
        d="M250 150 H420 L440 150 L458 70 L480 205 L498 150 H560 L574 118 L590 176 L604 150 H700 L718 88 L740 196 L758 150 H940"
        stroke="url(#pulse-fade)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="draw-on-view"
      />
      <circle cx="940" cy="150" r="6" fill="#ff3d6e" className="animate-pulse-glow" />
    </svg>
  );
}
