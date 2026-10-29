"use client";

import { useEffect, useId, useState } from "react";
import { clampStep, numText } from "@/lib/webapp/survey/customValue";
import { useApp } from "./AppContext";
import { Btn, inputCls, Kicker, Small } from "./ui";

export interface CustomNumber {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  bigStep: number;
  unit: string;
}

/**
 * The first-run questions' "Custom…" (build 54, the phone's CustomValuePicker): one number with − / + steps and a
 * field to type it, always inside [min, max]. Done hands it back; Escape or the backdrop closes it.
 */
export function CustomValueDialog({
  pick,
  onDone,
  onClose,
}: {
  pick: CustomNumber | null;
  onDone: (v: number) => void;
  onClose: () => void;
}) {
  if (!pick) return null;
  // Keyed on the pick: each opening starts from its own value.
  return <Dialog key={`${pick.title}:${pick.value}:${pick.unit}`} pick={pick} onDone={onDone} onClose={onClose} />;
}

function Dialog({ pick, onDone, onClose }: { pick: CustomNumber; onDone: (v: number) => void; onClose: () => void }) {
  const { t, lang, fmt } = useApp();
  const L = lang === "fr" ? "fr" : "en";
  const titleId = useId();
  const [v, setV] = useState(() => clampStep(pick.value, pick.min, pick.max, pick.step));
  const [text, setText] = useState(() => numText(clampStep(pick.value, pick.min, pick.max, pick.step), L));
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const to = (x: number) => {
    const c = clampStep(x, pick.min, pick.max, pick.step);
    setV(c);
    setText(numText(c, L));
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div aria-hidden className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl border border-line bg-night-2 p-5 shadow-xl">
        <div id={titleId}>
          <Kicker tone="volt">{pick.title}</Kicker>
        </div>
        <label className="flex items-center gap-2">
          <input
            className={inputCls + " text-center font-display text-2xl font-bold"}
            inputMode="decimal"
            value={text}
            aria-label={pick.title}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(n) && e.target.value.trim()) setV(clampStep(n, pick.min, pick.max, pick.step));
            }}
            onBlur={() => to(v)}
          />
          <span className="text-muted">{pick.unit}</span>
        </label>
        <div className="flex justify-center gap-2">
          {[-pick.bigStep, -pick.step, pick.step, pick.bigStep].map((d) => (
            <button
              key={d}
              type="button"
              className="min-h-11 min-w-14 rounded-full bg-surface-2 px-3 font-display font-semibold"
              onClick={() => to(v + d)}
            >
              {`${d > 0 ? "+" : "−"}${numText(Math.abs(d), L)}`}
            </button>
          ))}
        </div>
        <Small className="text-center">
          {fmt(t.common.customRange, { min: numText(pick.min, L), max: numText(pick.max, L), unit: pick.unit })}
        </Small>
        <Btn big variant="volt" className="w-full" onClick={() => onDone(v)}>
          {t.common.done}
        </Btn>
        <Btn className="w-full" variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Btn>
      </div>
    </div>
  );
}
