export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "vvake-theme";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

/** The saved choice wins; otherwise the OS setting; otherwise the brand's dark. */
export function resolveTheme(saved: unknown, prefersLight: boolean): Theme {
  if (isTheme(saved)) return saved;
  return prefersLight ? "light" : "dark";
}

/**
 * Runs in <head> before first paint so the page never flashes the other theme.
 * Kept dependency-free: it is inlined as a string.
 */
export const THEME_SCRIPT = `(function(){
var saved=null;try{saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}
var light=window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches;
document.documentElement.dataset.theme=saved==="light"||saved==="dark"?saved:light?"light":"dark";
})();`;
