"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  return new Promise((resolve, reject) => {
    const s = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    s.addEventListener("load", () => resolve(), { once: true });
    s.addEventListener("error", () => reject(new Error("turnstile")), { once: true });
    if (!existing) document.head.appendChild(s);
  });
}

/** Cloudflare Turnstile bot check (privacy-friendly, usually invisible). Reports a token, or "" when it expires. */
export function Turnstile({
  siteKey,
  onToken,
  theme = "auto",
}: {
  siteKey: string;
  onToken: (token: string) => void;
  theme?: "auto" | "dark" | "light";
}) {
  const box = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let id: string | undefined;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme,
          callback: (t: string) => callback.current(t),
          "expired-callback": () => callback.current(""),
          "error-callback": () => callback.current(""),
        });
      })
      .catch(() => callback.current(""));
    return () => {
      alive = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, theme]);

  return <div ref={box} className="min-h-[65px]" />;
}
