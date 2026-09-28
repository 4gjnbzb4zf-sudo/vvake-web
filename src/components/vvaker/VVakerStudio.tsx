"use client";

import { useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  DEFAULT_TRAITS,
  VVAKER_COLORS,
  VVAKER_HEADGEARS,
  VVAKER_MOODS,
  VVAKER_SPORTS,
  randomTraits,
  type VVakerColor,
  type VVakerTraits,
} from "./traits";
import { VVaker } from "./VVaker";

const EXPORT_SIZE = 1024;

export function VVakerStudio({ dict }: { dict: Dictionary["vvaker"] }) {
  const [traits, setTraits] = useState<VVakerTraits>(DEFAULT_TRAITS);
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof VVakerTraits>(key: K, value: VVakerTraits[K]) => setTraits((t) => ({ ...t, [key]: value }));

  async function download() {
    const svg = stageRef.current?.querySelector("svg");
    if (!svg) return;
    setBusy(true);
    try {
      const blob = await renderPng(svg);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vvaker-${traits.color}-${traits.sport}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div
        ref={stageRef}
        className="bg-voxel-grid relative mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-line bg-night-2"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(255_61_110/0.18),transparent_60%)]" />
        <VVaker {...traits} title={dict.alt} className="relative h-full w-full p-8" />
      </div>

      <div className="space-y-6">
        <ChipGroup label={dict.controls.color}>
          {(Object.keys(VVAKER_COLORS) as VVakerColor[]).map((c) => (
            <Chip key={c} active={traits.color === c} onClick={() => set("color", c)} label={dict.colors[c]}>
              <span className="h-4 w-4 rounded-[4px]" style={{ background: VVAKER_COLORS[c] }} />
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label={dict.controls.sport}>
          {VVAKER_SPORTS.map((s) => (
            <Chip key={s} active={traits.sport === s} onClick={() => set("sport", s)} label={dict.sports[s]} />
          ))}
        </ChipGroup>
        <ChipGroup label={dict.controls.headgear}>
          {VVAKER_HEADGEARS.map((h) => (
            <Chip key={h} active={traits.headgear === h} onClick={() => set("headgear", h)} label={dict.headgears[h]} />
          ))}
        </ChipGroup>
        <ChipGroup label={dict.controls.mood}>
          {VVAKER_MOODS.map((m) => (
            <Chip key={m} active={traits.mood === m} onClick={() => set("mood", m)} label={dict.moods[m]} />
          ))}
        </ChipGroup>
        <div>
          <label htmlFor="vvaker-energy" className="font-display text-sm font-semibold">
            {dict.controls.energy}: <span className="font-mono text-volt">{traits.energy}/4</span>
          </label>
          <input
            id="vvaker-energy"
            type="range"
            min={0}
            max={4}
            step={1}
            value={traits.energy}
            onChange={(e) => set("energy", Number(e.target.value))}
            className="mt-3 w-full accent-pulse"
          />
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={download} disabled={busy} className={buttonClass("primary")}>
            {dict.download}
          </button>
          <button type="button" onClick={() => setTraits(randomTraits())} className={buttonClass("ghost")}>
            {dict.shuffle}
          </button>
        </div>
        <p className="text-sm text-faint">{dict.note}</p>
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
        "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm transition-colors",
        props.active ? "border-pulse bg-pulse/15 text-text" : "border-line bg-surface text-muted hover:border-muted/50 hover:text-text",
      )}
    >
      {props.children}
      {props.label}
    </button>
  );
}

/** Rasterises the avatar SVG onto a branded square canvas. */
async function renderPng(svg: SVGSVGElement): Promise<Blob> {
  const markup = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#0e1012";
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
  const glow = ctx.createRadialGradient(512, 420, 40, 512, 420, 560);
  glow.addColorStop(0, "rgba(255,61,110,0.28)");
  glow.addColorStop(1, "rgba(255,61,110,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

  // viewBox is 240×300: fit by height with padding.
  const h = EXPORT_SIZE * 0.86;
  const w = h * (240 / 300);
  ctx.drawImage(img, (EXPORT_SIZE - w) / 2, EXPORT_SIZE * 0.08, w, h);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}
