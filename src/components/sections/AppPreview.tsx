import { Section } from "@/components/ui/Section";
import { VVaker } from "@/components/vvaker/VVaker";
import type { Dictionary } from "@/i18n/dictionaries";

/** Phone + watch preview of the app's daily ritual (visual only; the apps ship city by city). */
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
      <div className="mt-14 grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative flex items-end justify-center gap-6 sm:gap-10" aria-hidden="true">
          <div className="pointer-events-none absolute inset-x-10 top-10 bottom-0 rounded-full bg-pulse/15 blur-[90px]" />
          <PhoneMock dict={dict.phone} />
          <WatchMock dict={dict.watch} />
        </div>

        <div>
          <ol className="space-y-6">
            {dict.points.map((p, i) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-0.5 font-mono text-sm text-pulse">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 font-mono text-xs tracking-[0.16em] text-faint uppercase">{dict.platforms}</p>
          <p className="mt-2 inline-flex rounded-full border border-volt/40 bg-volt/10 px-3 py-1 font-mono text-xs text-volt">
            {dict.soon}
          </p>
        </div>
      </div>
    </Section>
  );
}

function PhoneMock({ dict }: { dict: Dictionary["app"]["phone"] }) {
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

        <div className="grid grid-cols-[84px_1fr] items-center gap-2 rounded-2xl border border-line bg-surface p-2.5">
          <VVaker color="candy" sport="runner" headgear="none" energy={3} className="h-[104px] w-auto" />
          <div>
            <p className="font-mono text-[9px] tracking-[0.12em] text-volt uppercase">{dict.energy}</p>
            <p className="mt-1 font-display text-3xl leading-none font-bold">
              3<span className="text-base text-faint"> / 4</span>
            </p>
            <p className="mt-1 text-[10.5px] text-muted">{dict.minutes}</p>
            <p className="mt-1 font-mono text-[9px] text-faint">{dict.refill}</p>
          </div>
        </div>

        <div className="flex h-10 items-center justify-center rounded-xl bg-pulse font-display text-[13px] font-semibold text-night shadow-[0_10px_30px_-10px_rgb(255_61_110/0.6)]">
          ▶&nbsp; {dict.start}
        </div>

        <div className="rounded-2xl border border-down/40 bg-surface p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-[0.12em] text-down uppercase">{dict.rally}</span>
            <span className="rounded-full border border-line px-1.5 py-0.5 font-mono text-[9px] text-down">LULU −4.1%</span>
          </div>
          <p className="mt-1 text-[11.5px]">{dict.rallyBody}</p>
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

        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-2.5 py-2 text-[11.5px]">
          <span>{dict.squad}</span>
          <span className="font-mono text-volt">74%</span>
        </div>
      </div>
    </div>
  );
}

function WatchMock({ dict }: { dict: Dictionary["app"]["watch"] }) {
  return (
    <div className="relative mb-10 flex h-[196px] w-[160px] shrink-0 flex-col rounded-[2.6rem] border-[8px] border-[#202428] bg-black p-3.5 shadow-2xl shadow-black/60 sm:h-[216px] sm:w-[176px]">
      <span className="absolute top-14 -right-[13px] h-9 w-[7px] rounded bg-[#2b3035]" />
      <p className="text-right text-[10px] font-semibold">6:14</p>
      <p className="font-mono text-[9px] tracking-[0.1em] text-pulse uppercase">{dict.zone}</p>
      <p className="mt-1 font-display text-[40px] leading-none font-bold">
        152<span className="text-sm text-pulse"> ♥</span>
      </p>
      <div className="mt-2 flex gap-3">
        <div>
          <p className="font-mono text-[8px] text-faint uppercase">{dict.effort}</p>
          <p className="font-display text-sm font-semibold">42</p>
        </div>
        <div>
          <p className="font-mono text-[8px] text-faint uppercase">{dict.time}</p>
          <p className="font-display text-sm font-semibold">12:08</p>
        </div>
      </div>
      <div className="mt-auto flex gap-1">
        <i className="h-2 flex-1 rounded-sm bg-pulse" />
        <i className="h-2 flex-1 rounded-sm bg-pulse-soft" />
        <i className="h-2 flex-1 rounded-sm border border-[#343a41] bg-[#22262b]" />
        <i className="h-2 flex-1 rounded-sm border border-[#343a41] bg-[#22262b]" />
      </div>
    </div>
  );
}
