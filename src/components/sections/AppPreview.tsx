import { Section } from "@/components/ui/Section";
import { MoneyText } from "@/components/ui/Money";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";

/** The app's promises; the phone + watch mocks are exported for the hero (visual only; the apps ship city by city). */
export function AppPreview({ dict, index }: { dict: Dictionary["app"]; index: string }) {
  return (
    <Section id="app" index={index} kicker={dict.kicker} title={dict.title} lead={dict.body} className="isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="text-outline pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 font-display text-[16vw] leading-[0.9] font-bold whitespace-nowrap italic opacity-60 select-none"
      >
        VVAKE UP VVAKE UP
      </div>
      <div aria-hidden="true" className="hazard-pulse pointer-events-none absolute top-24 -left-2 h-32 w-6" />
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {dict.points.map((p, i) => (
          <li key={p.title} className="rounded-3xl border border-line bg-surface/70 p-6 backdrop-blur">
            <span className="font-mono text-sm text-pulse">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 font-display text-lg font-semibold">{p.title}</h3>
            <p className="mt-1.5 leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <p className="font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.platforms}</p>
        <p className="inline-flex rounded-full border border-volt/40 bg-volt/10 px-3 py-1 font-mono text-xs text-volt">{dict.soon}</p>
      </div>
    </Section>
  );
}

export function PhoneMock({ dict }: { dict: Dictionary["app"]["phone"] }) {
  return (
    <div className="relative w-[248px] shrink-0 rounded-[2.6rem] border-[7px] border-[#202428] bg-night shadow-2xl shadow-black/60 sm:w-[280px]">
      <div className="flex items-center justify-between px-6 pt-3 pb-2 text-[11px] font-semibold">
        <span>6:02</span>
        <span className="h-5 w-20 rounded-full bg-black" />
        <span>98%</span>
      </div>
      <div className="space-y-2.5 px-3.5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] text-faint uppercase">{dict.greeting}</p>
            <p className="font-display text-[15px] font-semibold">{dict.hello}</p>
          </div>
          <span className="rounded-full border border-volt/40 px-2 py-0.5 font-mono text-[10px] text-volt">🔥 23</span>
        </div>

        <div className="rounded-2xl border border-volt/40 bg-surface p-2.5">
          <p className="font-mono text-[9px] tracking-[0.12em] text-volt uppercase">{dict.today}</p>
          <div className="mt-1 flex items-center gap-2">
            <VVaker color="candy" sport="runner" headgear="none" energy={3} className="h-14 w-auto" />
            <div>
              <p className="font-display text-[14px] leading-tight font-semibold">{dict.todaySession}</p>
              <p className="mt-0.5 font-mono text-[9.5px] text-muted">📅 {dict.todayWhen}</p>
            </div>
          </div>
        </div>

        <div className="flex h-10 items-center justify-center rounded-xl bg-pulse font-display text-[13px] font-semibold text-night shadow-[0_10px_30px_-10px_rgb(255_61_110/0.6)]">
          ▶&nbsp; {dict.start}
        </div>

        <div className="rounded-2xl border border-mint/40 bg-surface p-2.5">
          <p className="font-mono text-[9px] tracking-[0.12em] text-mint uppercase">{dict.wealth}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] whitespace-nowrap">
            <span className="text-muted">📈 {dict.invested}</span>
            <span className="font-display font-semibold text-mint">
              <MoneyText template={dict.investedValue} usd={4} />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] whitespace-nowrap">
            <span className="text-muted">🏆 {dict.rewards}</span>
            <span className="font-display font-semibold">{dict.rewardsValue}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-2.5">
          <p className="font-mono text-[9px] tracking-[0.12em] text-pulse uppercase">{dict.clash}</p>
          <div className="mt-1.5 flex items-center justify-between font-display text-[13px] font-semibold">
            <span>
              Lyon <span className="text-pulse">61.3</span>
            </span>
            <span>
              <span className="text-muted">58.9</span> St-Étienne
            </span>
          </div>
          <div className="stripe-bar mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full w-[51%] rounded-full bg-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Apple-Watch-style face cycling through a live workout, a Rally alert and a ghost race (pure CSS). */
export function WatchMock({ dict }: { dict: Dictionary["app"]["watch"] }) {
  return (
    <div className="relative mb-10 shrink-0">
      {/* straps */}
      <div className="absolute -top-10 left-1/2 h-12 w-[104px] -translate-x-1/2 rounded-t-3xl bg-gradient-to-b from-[#1a1d21] to-[#2a2f35]" />
      <div className="absolute -bottom-10 left-1/2 h-12 w-[104px] -translate-x-1/2 rounded-b-3xl bg-gradient-to-t from-[#1a1d21] to-[#2a2f35]" />
      <div className="relative h-[196px] w-[160px] overflow-hidden rounded-[2.6rem] border-[8px] border-[#2a2f35] bg-black shadow-2xl ring-1 shadow-black/60 ring-white/10 sm:h-[216px] sm:w-[176px]">
        {/* digital crown + side button */}
        <span className="absolute top-12 -right-[3px] z-10 h-8 w-[5px] rounded bg-pulse shadow-[0_0_10px_#ff3d6e]" />

        {/* 1 · live workout */}
        <div className="vv-watch absolute inset-0 flex flex-col p-3.5" style={{ animationDelay: "0s" }}>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] tracking-[0.1em] text-pulse uppercase">{dict.zone}</p>
            <p className="text-[10px] font-semibold">6:14</p>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="font-display text-[38px] leading-none font-bold tabular-nums">152</p>
            <span className="animate-heartbeat text-lg text-pulse">♥</span>
          </div>
          <svg viewBox="0 0 120 24" className="mt-1 h-5 w-full" aria-hidden="true">
            <path
              d="M0 12 H30 L36 12 L40 2 L46 22 L50 12 H78 L82 6 L86 18 L90 12 H120"
              stroke="#ff3d6e"
              strokeWidth="2.2"
              fill="none"
              pathLength={1}
              className="vv-ecg"
            />
          </svg>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="font-mono text-[8px] text-faint uppercase">{dict.effort}</p>
              <p className="font-display text-sm font-semibold">42</p>
              <p className="mt-0.5 font-mono text-[8px] text-faint uppercase">{dict.time}</p>
              <p className="font-display text-sm font-semibold tabular-nums">12:08</p>
            </div>
            <VVaker sport="runner" color="candy" energy={3} className="h-16 w-auto" />
          </div>
          <div className="mt-auto flex gap-1">
            {["bg-sky", "bg-mint", "bg-pulse", "bg-[#343a41]", "bg-[#343a41]"].map((c, i) => (
              <i key={i} className={`h-2 flex-1 rounded-sm ${c} ${i === 2 ? "animate-pulse shadow-[0_0_8px_#ff3d6e]" : ""}`} />
            ))}
          </div>
        </div>

        {/* 2 · Rally alert */}
        <div
          className="vv-watch absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-down/30 to-black p-3.5 text-center"
          style={{ animationDelay: "-8s" }}
        >
          <span className="text-2xl">⚡</span>
          <p className="mt-1 font-display text-lg font-bold text-down">{dict.rally}</p>
          <p className="mt-0.5 font-mono text-[9px] text-muted">{dict.rallyBody}</p>
          <span className="mt-3 rounded-full bg-pulse px-3 py-1.5 font-display text-[10px] font-semibold text-night">{dict.join}</span>
          <p className="mt-2 font-mono text-[8px] text-volt">⚔️ {dict.clash}</p>
        </div>

        {/* 3 · ghost race */}
        <div className="vv-watch absolute inset-0 flex flex-col p-3.5" style={{ animationDelay: "-4s" }}>
          <p className="font-mono text-[9px] tracking-[0.1em] text-volt uppercase">👻 {dict.ghost}</p>
          <p className="mt-2 font-display text-[34px] leading-none font-bold text-volt">+42 m</p>
          <p className="font-mono text-[9px] text-muted">{dict.ahead}</p>
          <div className="relative mt-auto h-8">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#343a41]" />
            <span className="absolute top-1/2 left-[46%] h-3 w-3 -translate-y-1/2 rounded-full bg-white/40" />
            <span className="vv-ghost-me absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-volt shadow-[0_0_10px_#ccff00]" />
          </div>
        </div>
      </div>
    </div>
  );
}
