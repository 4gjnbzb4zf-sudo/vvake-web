"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";
import {
  ANIMALS,
  ATTITUDES,
  BOTTOMS,
  BUILDS,
  GEAR,
  HEADWEAR,
  SHOES,
  SPORTS,
  TOPS,
  buildPersonaPrompt,
  personaCode,
  type Persona,
} from "@/lib/personaPrompt";
import { savePersona, saveRenders, usePersona, useRenders } from "@/lib/prefs";
import { useSportLabel } from "@/lib/sportNames";
import { VVAKER_SPORTS } from "./traits";
import { VVaker } from "./VVaker";

type Tab = "animal" | "sport" | "fit" | "gear";
const TABS: readonly Tab[] = ["animal", "sport", "fit", "gear"];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-volt-fg bg-volt text-ink" : "border-line text-muted hover:border-volt-fg/50 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

const RENDER_SERVER = "http://localhost:3101";

/** True only on localhost with the dev render server running (tools/imagine/render-server.mjs). */
function useLocalRenderer(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
    let alive = true;
    fetch(`${RENDER_SERVER}/health`)
      .then((r) => r.ok && alive && setOk(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

/** Draws the persona on the dark VVake stage for avatar / X banner downloads. */
async function renderCard(img: HTMLImageElement, kind: "avatar" | "banner", name: string, tagline: string): Promise<Blob> {
  const [w, h] = kind === "avatar" ? [1024, 1024] : [1500, 500];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const cx = kind === "avatar" ? w / 2 : w * 0.78;
  const bg = ctx.createRadialGradient(cx, h * 0.45, 20, cx, h * 0.45, Math.max(w, h) * 0.7);
  bg.addColorStop(0, "#2b2f33");
  bg.addColorStop(1, "#0e1012");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const ih = h * (kind === "avatar" ? 0.9 : 0.94);
  const iw = ih * (img.naturalWidth / img.naturalHeight);
  ctx.drawImage(img, cx - iw / 2, h - ih - h * 0.02, iw, ih);
  if (kind === "banner") {
    const display = getComputedStyle(document.documentElement).getPropertyValue("--font-unbounded").trim() || "sans-serif";
    ctx.fillStyle = "#e6e9eb";
    ctx.font = `700 120px ${display}`;
    ctx.fillText("VVAKE", 90, 250);
    ctx.font = `600 40px ${display}`;
    ctx.fillText(name || tagline, 94, 320);
    ctx.fillStyle = "#ccff00";
    ctx.font = `600 26px ${display}`;
    ctx.fillText("vvake.com", 94, 380);
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Persona generator: the player builds their VVaker (animal, sport, fit, gear, vibe). The choices become
 * the exact Grok Imagine prompt (master prompt v0.3); the preview shows our cast member for that sport
 * until the player's own render at launch. Saved in this browser; the coach calls with it.
 */
export function PersonaBuilder({
  dict,
  tagline,
  sportNames,
}: {
  dict: Dictionary["vvaker"]["persona"];
  tagline: string;
  sportNames: Dictionary["multisport"]["sports"];
}) {
  const persona = usePersona();
  const sportLabel = useSportLabel();
  const [tab, setTab] = useState<Tab>("animal");
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const localRender = useLocalRenderer();
  const renders = useRenders();
  const stage = useRef<HTMLDivElement>(null);
  const update = (next: Partial<Persona>) => savePersona({ ...persona, ...next });
  const prompt = buildPersonaPrompt(persona);
  const castAnimal = SPORTS[persona.sport].animal;
  const code = personaCode(persona, VVAKER_SPORTS);
  const rendered = renders[code];

  const renderMine = async () => {
    setRendering(true);
    setRenderError(false);
    try {
      const r = await fetch(`${RENDER_SERVER}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, code }),
      });
      const json = (await r.json()) as { url?: string };
      if (!r.ok || !json.url) throw new Error("render failed");
      saveRenders({ ...renders, [code]: json.url });
    } catch {
      setRenderError(true);
    } finally {
      setRendering(false);
    }
  };

  const exportImage = async (kind: "avatar" | "banner") => {
    const img = stage.current?.querySelector("img");
    if (!img) return;
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
    download(await renderCard(img, kind, persona.name, tagline), `vvaker-${persona.animal}-${persona.sport}-${kind}.png`);
  };

  return (
    <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1fr_1.15fr]">
      <div className="lg:sticky lg:top-24">
        <div
          ref={stage}
          className="relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden rounded-[2rem] border border-line bg-[radial-gradient(circle_at_50%_40%,#2b2f33,#0e1012_70%)]"
        >
          <div className="pointer-events-none absolute inset-x-10 bottom-6 h-10 rounded-full bg-volt/20 blur-2xl" />
          <div key={rendered ?? persona.sport} className="relative flex h-full w-full animate-pop items-end justify-center px-6 pt-6">
            {rendered ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={rendered} alt={persona.name || dict.title} className="h-full w-auto object-contain" />
            ) : (
              <VVaker sport={persona.sport} title={persona.name || dict.title} className="h-full w-auto" />
            )}
          </div>
          {persona.name && (
            <p className="absolute top-4 left-4 rounded-full bg-night/80 px-3 py-1 font-display text-sm font-semibold backdrop-blur">
              {persona.name}
            </p>
          )}
        </div>
        <p className="mx-auto mt-3 max-w-[460px] text-center text-xs text-faint">
          {rendered
            ? dict.yours
            : dict.preview.replace("{animal}", castAnimal).replace("{mine}", dict.animals[persona.animal].toLowerCase())}
        </p>
        <div className="mx-auto mt-4 flex max-w-[460px] flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => exportImage("avatar")} className={buttonClass("primary", "flex-1 px-4 whitespace-nowrap")}>
            ⬇ {dict.downloadVVaker}
          </button>
          <button type="button" onClick={() => exportImage("banner")} className={buttonClass("ghost", "flex-1 px-4 whitespace-nowrap")}>
            ⬇ {dict.downloadBanner}
          </button>
        </div>
        <div className="mx-auto mt-4 max-w-[460px] rounded-2xl border border-volt-fg/30 bg-volt/5 p-4">
          <p className="font-mono text-[0.68rem] tracking-[0.16em] text-faint uppercase">{dict.code}</p>
          <p className="mt-1 font-mono text-xl font-medium tracking-wider text-volt-fg" aria-live="polite">
            {code}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{dict.codeNote}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
        <h3 className="font-display text-xl font-semibold">{dict.title}</h3>
        <p className="mt-1 text-sm text-muted">{dict.intro}</p>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">{dict.name}</span>
          <input
            value={persona.name}
            maxLength={24}
            placeholder={dict.namePlaceholder}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-2 h-10 w-full rounded-xl border border-line bg-night px-3 text-sm outline-none focus:border-volt-fg"
          />
        </label>

        <div role="tablist" aria-label={dict.title} className="mt-5 flex flex-wrap rounded-xl border border-line bg-night p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 font-display text-sm font-semibold transition-colors",
                tab === t ? "bg-pulse text-ink" : "text-muted hover:text-text",
              )}
            >
              {dict.tabs[t]}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-5">
          {tab === "animal" && (
            <Group label={dict.tabs.animal}>
              {(Object.keys(ANIMALS) as Persona["animal"][]).map((a) => (
                <Chip key={a} active={persona.animal === a} onClick={() => update({ animal: a })}>
                  {dict.animals[a]}
                </Chip>
              ))}
            </Group>
          )}
          {tab === "sport" && (
            <Group label={dict.tabs.sport}>
              {VVAKER_SPORTS.map((s) => (
                <Chip key={s} active={persona.sport === s} onClick={() => update({ sport: s })}>
                  {sportLabel(s, sportNames[s])}
                </Chip>
              ))}
            </Group>
          )}
          {tab === "fit" && (
            <>
              <Group label={dict.top}>
                {(Object.keys(TOPS) as Persona["top"][]).map((v) => (
                  <Chip key={v} active={persona.top === v} onClick={() => update({ top: v })}>
                    {dict.tops[v]}
                  </Chip>
                ))}
              </Group>
              <Group label={dict.bottoms}>
                {(Object.keys(BOTTOMS) as Persona["bottoms"][]).map((v) => (
                  <Chip key={v} active={persona.bottoms === v} onClick={() => update({ bottoms: v })}>
                    {dict.bottomsList[v]}
                  </Chip>
                ))}
              </Group>
              <Group label={dict.headwear}>
                {(Object.keys(HEADWEAR) as Persona["headwear"][]).map((v) => (
                  <Chip key={v} active={persona.headwear === v} onClick={() => update({ headwear: v })}>
                    {dict.headwearList[v]}
                  </Chip>
                ))}
              </Group>
              <Group label={dict.shoes}>
                {(Object.keys(SHOES) as Persona["shoes"][]).map((v) => (
                  <Chip key={v} active={persona.shoes === v} onClick={() => update({ shoes: v })}>
                    {dict.shoesList[v]}
                  </Chip>
                ))}
              </Group>
            </>
          )}
          {tab === "gear" && (
            <>
              <Group label={dict.gear}>
                {(Object.keys(GEAR) as Persona["gear"]).map((g) => (
                  <Chip
                    key={g}
                    active={persona.gear.includes(g)}
                    onClick={() => update({ gear: persona.gear.includes(g) ? persona.gear.filter((x) => x !== g) : [...persona.gear, g] })}
                  >
                    {dict.gearList[g]}
                  </Chip>
                ))}
              </Group>
              <Group label={dict.build}>
                {(Object.keys(BUILDS) as Persona["build"][]).map((v) => (
                  <Chip key={v} active={persona.build === v} onClick={() => update({ build: v })}>
                    {dict.builds[v]}
                  </Chip>
                ))}
              </Group>
              <Group label={dict.attitude}>
                {(Object.keys(ATTITUDES) as Persona["attitude"][]).map((v) => (
                  <Chip key={v} active={persona.attitude === v} onClick={() => update({ attitude: v })}>
                    {dict.attitudes[v]}
                  </Chip>
                ))}
              </Group>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {localRender ? (
            <>
              <button type="button" onClick={renderMine} disabled={rendering} className={buttonClass("primary", "px-5")}>
                {rendering ? `⏳ ${dict.rendering}` : `✨ ${dict.generate}`}
              </button>
              <span className="font-mono text-xs text-faint">{renderError ? dict.renderFailed : dict.localRender}</span>
            </>
          ) : (
            <>
              <span aria-disabled="true" className={buttonClass("primary", "cursor-not-allowed px-5 opacity-60")}>
                ✨ {dict.generate}
              </span>
              <span className="font-mono text-xs text-faint">{dict.soon}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
