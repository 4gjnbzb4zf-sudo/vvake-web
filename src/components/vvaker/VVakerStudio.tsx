"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useSportLabel } from "@/lib/sportNames";
import { buttonClass } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import { encodeDna } from "@/lib/dna";
import { saveStudio, setLookPref, useLookPref, useStudio } from "@/lib/prefs";
import {
  FAN_KITS,
  VVAKER_ACCENTS,
  VVAKER_ACCESSORIES,
  VVAKER_BACKGROUNDS,
  VVAKER_COLORS,
  VVAKER_EYES,
  VVAKER_HEADGEARS,
  VVAKER_LOOKS,
  VVAKER_HAIRS,
  VVAKER_FACIALS,
  VVAKER_TATTOOS,
  VVAKER_PIERCINGS,
  VVAKER_SCARS,
  VVAKER_PHYSIQUES,
  VVAKER_EYE_COLORS,
  VVAKER_MOUTHS,
  VVAKER_SPORTS,
  clampBib,
  randomTraits,
  type FanKit,
  type VVakerAccent,
  type VVakerBackground,
  type VVakerColor,
  type VVakerEyeColor,
  type VVakerTraits,
} from "./traits";
import { VVaker } from "./VVaker";

type Tab = "body" | "gear" | "sport" | "face" | "ink";
const TABS: readonly Tab[] = ["body", "gear", "sport", "face", "ink"];

export function VVakerStudio({ dict }: { dict: Dictionary["vvaker"] }) {
  // Restored from this browser on the next visit (lib/prefs.ts); defaults until then.
  const sportLabel = useSportLabel();
  const saved = useStudio();
  const pref = useLookPref();
  // The style is the site-wide switch (header menu or here); the rest is this studio's own VVaker.
  const traits: VVakerTraits = { ...saved.traits, look: pref ?? saved.traits.look };
  const { background } = saved;
  const setTraits = (next: VVakerTraits) => saveStudio({ ...saved, traits: next });
  const setBackground = (b: VVakerBackground) => saveStudio({ ...saved, background: b });
  const [tab, setTab] = useState<Tab>("body");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  /** Every change re-keys the avatar so it "pops". */
  function update(next: Partial<VVakerTraits>) {
    setTraits({ ...traits, ...next });
    setVersion((v) => v + 1);
  }

  async function exportImage(kind: "avatar" | "banner") {
    const svg = stageRef.current?.querySelector("svg");
    if (!svg) return;
    setBusy(true);
    try {
      const blob = kind === "avatar" ? await renderAvatar(svg, background) : await renderBanner(svg, background, dict.bannerTagline);
      download(blob, `vvaker-${traits.color}-${traits.sport}-${kind}.png`);
    } finally {
      setBusy(false);
    }
  }

  const bg = VVAKER_BACKGROUNDS[background];

  return (
    <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="lg:sticky lg:top-24">
        <div
          ref={stageRef}
          className={cn(
            "relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-line",
            background === "night" && "bg-voxel-grid",
          )}
          style={{ backgroundColor: bg }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(255_255_255/0.16),transparent_60%)]" />
          <div key={version} className="relative h-full w-full animate-pop">
            <VVaker {...traits} lockLook title={dict.alt} className="h-full w-full p-8" />
          </div>
        </div>
        <div className="mx-auto mt-4 flex max-w-[440px] flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => exportImage("avatar")}
            disabled={busy}
            className={buttonClass("primary", "flex-1 px-4 whitespace-nowrap")}
          >
            {dict.download}
          </button>
          <button
            type="button"
            onClick={() => exportImage("banner")}
            disabled={busy}
            className={buttonClass("ghost", "flex-1 px-4 whitespace-nowrap")}
          >
            {dict.downloadBanner}
          </button>
        </div>
        <div className="mx-auto mt-4 max-w-[440px] rounded-2xl border border-volt/30 bg-volt/5 p-4">
          <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">{dict.dna.label}</p>
          <p className="mt-1 font-mono text-xl font-medium tracking-wider text-volt" aria-live="polite">
            {encodeDna(traits, background)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{dict.dna.note}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label={dict.title} className="flex rounded-xl border border-line bg-night p-1">
            {TABS.map((t) => (
              <button
                key={t}
                id={`${baseId}-${t}`}
                role="tab"
                type="button"
                aria-selected={tab === t}
                aria-controls={`${baseId}-panel`}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-lg px-3.5 py-2 font-display text-xs font-semibold transition-colors sm:px-4 sm:text-sm",
                  tab === t ? "bg-pulse text-night" : "text-muted hover:text-text",
                )}
              >
                {dict.tabs[t]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setTraits({ ...randomTraits(), look: traits.look });
              setVersion((v) => v + 1);
            }}
            className={buttonClass("ghost", "h-10 px-4")}
          >
            <span aria-hidden="true">🎲</span>
            {dict.shuffle}
          </button>
        </div>

        <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-${tab}`} className="mt-6 space-y-6">
          {tab === "body" && (
            <>
              <ChipGroup label={dict.controls.style}>
                {VVAKER_LOOKS.map((l) => (
                  <Chip
                    key={l}
                    active={traits.look === l}
                    onClick={() => {
                      update({ look: l });
                      setLookPref(l);
                    }}
                    label={dict.looks[l]}
                  />
                ))}
              </ChipGroup>
              <p className="-mt-3 text-xs text-faint">{dict.styleNote}</p>
              <ChipGroup label={dict.controls.physique}>
                {VVAKER_PHYSIQUES.map((v) => (
                  <Chip key={v} active={traits.physique === v} onClick={() => update({ physique: v })} label={dict.physiques[v]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.color}>
                {(Object.keys(VVAKER_COLORS) as VVakerColor[]).map((c) => (
                  <Swatch
                    key={c}
                    color={VVAKER_COLORS[c]}
                    label={dict.colors[c]}
                    active={traits.color === c}
                    onClick={() => update({ color: c })}
                  />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.background}>
                {(Object.keys(VVAKER_BACKGROUNDS) as VVakerBackground[]).map((b) => (
                  <Swatch
                    key={b}
                    color={VVAKER_BACKGROUNDS[b]}
                    label={dict.backgrounds[b]}
                    active={background === b}
                    onClick={() => setBackground(b)}
                  />
                ))}
              </ChipGroup>
            </>
          )}

          {tab === "gear" && (
            <>
              <ChipGroup label={dict.controls.accent}>
                {(Object.keys(VVAKER_ACCENTS) as VVakerAccent[]).map((a) => (
                  <Swatch
                    key={a}
                    color={VVAKER_ACCENTS[a]}
                    label={dict.accents[a]}
                    active={traits.accent === a}
                    onClick={() => update({ accent: a })}
                  />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.headgear}>
                {VVAKER_HEADGEARS.map((h) => (
                  <Chip key={h} active={traits.headgear === h} onClick={() => update({ headgear: h })} label={dict.headgears[h]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.accessory}>
                {VVAKER_ACCESSORIES.map((a) => (
                  <Chip key={a} active={traits.accessory === a} onClick={() => update({ accessory: a })} label={dict.accessories[a]} />
                ))}
              </ChipGroup>
              {traits.accessory === "bib" && (
                <div>
                  <label htmlFor={`${baseId}-bib`} className="font-display text-sm font-semibold">
                    {dict.controls.bib}
                  </label>
                  <input
                    id={`${baseId}-bib`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={traits.bib}
                    onChange={(e) => update({ bib: clampBib(Number(e.target.value)) })}
                    className="mt-3 block h-11 w-28 rounded-xl border border-line bg-night px-4 font-mono text-text outline-none focus:border-pulse"
                  />
                </div>
              )}
              <ChipGroup label={dict.controls.fan}>
                {(Object.keys(FAN_KITS) as FanKit[]).map((k) => {
                  const colors = FAN_KITS[k];
                  return (
                    <Chip key={k} active={traits.fan === k} onClick={() => update({ fan: k })} label={dict.fanKits[k]}>
                      {colors && (
                        <span className="flex h-4 w-4 overflow-hidden rounded-[4px] border border-black/40">
                          <span className="w-1/2" style={{ background: colors[0] }} />
                          <span className="w-1/2" style={{ background: colors[1] }} />
                        </span>
                      )}
                    </Chip>
                  );
                })}
              </ChipGroup>
              <p className="-mt-3 text-xs text-faint">{dict.fanNote}</p>
            </>
          )}

          {tab === "sport" && (
            <ChipGroup label={dict.controls.sport}>
              {VVAKER_SPORTS.map((s) => (
                <Chip key={s} active={traits.sport === s} onClick={() => update({ sport: s })} label={sportLabel(s, dict.sports[s])} />
              ))}
            </ChipGroup>
          )}

          {tab === "ink" && (
            <>
              <ChipGroup label={dict.controls.hair}>
                {VVAKER_HAIRS.map((v) => (
                  <Chip key={v} active={traits.hair === v} onClick={() => update({ hair: v })} label={dict.hairs[v]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.facial}>
                {VVAKER_FACIALS.map((v) => (
                  <Chip key={v} active={traits.facial === v} onClick={() => update({ facial: v })} label={dict.facials[v]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.tattoo}>
                {VVAKER_TATTOOS.map((v) => (
                  <Chip key={v} active={traits.tattoo === v} onClick={() => update({ tattoo: v })} label={dict.tattoos[v]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.piercing}>
                {VVAKER_PIERCINGS.map((v) => (
                  <Chip key={v} active={traits.piercing === v} onClick={() => update({ piercing: v })} label={dict.piercings[v]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.scar}>
                {VVAKER_SCARS.map((v) => (
                  <Chip key={v} active={traits.scar === v} onClick={() => update({ scar: v })} label={dict.scars[v]} />
                ))}
              </ChipGroup>
            </>
          )}

          {tab === "face" && (
            <>
              <ChipGroup label={dict.controls.eyeColor}>
                {(Object.keys(VVAKER_EYE_COLORS) as VVakerEyeColor[]).map((c) => (
                  <Swatch
                    key={c}
                    color={VVAKER_EYE_COLORS[c]}
                    label={dict.eyeColors[c]}
                    active={traits.eyeColor === c}
                    onClick={() => update({ eyeColor: c })}
                  />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.eyes}>
                {VVAKER_EYES.map((e) => (
                  <Chip key={e} active={traits.eyes === e} onClick={() => update({ eyes: e })} label={dict.eyes[e]} />
                ))}
              </ChipGroup>
              <ChipGroup label={dict.controls.mouth}>
                {VVAKER_MOUTHS.map((m) => (
                  <Chip key={m} active={traits.mouth === m} onClick={() => update({ mouth: m })} label={dict.mouths[m]} />
                ))}
              </ChipGroup>
            </>
          )}

          <div>
            <label htmlFor={`${baseId}-energy`} className="font-display text-sm font-semibold">
              {dict.controls.energy}: <span className="font-mono text-volt">{traits.energy}/4</span>
            </label>
            <input
              id={`${baseId}-energy`}
              type="range"
              min={0}
              max={4}
              step={1}
              value={traits.energy}
              onChange={(e) => update({ energy: Number(e.target.value) })}
              className="mt-3 w-full accent-pulse"
            />
          </div>
        </div>
        <p className="mt-6 text-sm text-faint">{dict.note}</p>
      </div>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="font-display text-sm font-semibold">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip(props: { active: boolean; onClick: () => void; label: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm transition-all duration-150 active:scale-95",
        props.active ? "border-pulse bg-pulse/15 text-text" : "border-line bg-night text-muted hover:border-muted/50 hover:text-text",
      )}
    >
      {props.children}
      {props.label}
    </button>
  );
}

function Swatch({ color, label, active, onClick }: { color: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <Chip active={active} onClick={onClick} label={label}>
      <span className="h-4 w-4 rounded-[4px] border border-black/40" style={{ background: color }} />
    </Chip>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadSvg(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const markup = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  return img;
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

/** Relative luminance check so text stays readable on light backgrounds. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: VVakerBackground, glowX: number) {
  ctx.fillStyle = VVAKER_BACKGROUNDS[background];
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(glowX, height * 0.42, 40, glowX, height * 0.42, height * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

async function renderAvatar(svg: SVGSVGElement, background: VVakerBackground): Promise<Blob> {
  const size = 1024;
  const img = await loadSvg(svg);
  const { canvas, ctx } = canvas2d(size, size);
  paintBackground(ctx, size, size, background, size / 2);
  // viewBox is 240×300: fit by height with padding.
  const h = size * 0.86;
  const w = h * (240 / 300);
  ctx.drawImage(img, (size - w) / 2, size * 0.08, w, h);
  return toPng(canvas);
}

/** 1500×500 X/Twitter header: wordmark + tagline on the left, the VVaker on the right. */
async function renderBanner(svg: SVGSVGElement, background: VVakerBackground, tagline: string): Promise<Blob> {
  const [width, height] = [1500, 500];
  const img = await loadSvg(svg);
  await document.fonts.ready;
  const { canvas, ctx } = canvas2d(width, height);
  paintBackground(ctx, width, height, background, width * 0.78);

  const ink = isLight(VVAKER_BACKGROUNDS[background]) ? "#0e1012" : "#e6e9eb";
  const rootStyle = getComputedStyle(document.documentElement);
  const display = rootStyle.getPropertyValue("--font-unbounded").trim() || "sans-serif";
  const mono = rootStyle.getPropertyValue("--font-jetbrains").trim() || "monospace";

  ctx.fillStyle = ink;
  ctx.font = `700 132px ${display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("VVAKE", 96, 270);
  ctx.font = `600 40px ${display}`;
  ctx.fillText(tagline, 100, 340);
  ctx.font = `500 26px ${mono}`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("vvake.com", 100, 400);
  ctx.globalAlpha = 1;

  // X crops the banner's lower-left for the profile picture, so the avatar sits on the right.
  const h = height * 0.92;
  const w = h * (240 / 300);
  ctx.drawImage(img, width * 0.78 - w / 2, height * 0.04, w, h);
  return toPng(canvas);
}
