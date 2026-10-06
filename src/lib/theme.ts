export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
/** What the visitor picks: the device's appearance (default, like the app), or always light / dark. */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export const THEME_STORAGE_KEY = "vvake-theme";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

/** The saved choice: light or dark when the visitor picked one, otherwise "system". */
export function themeChoice(saved: unknown): ThemeChoice {
  return isTheme(saved) ? saved : "system";
}

/** The theme shown: the visitor's choice, else the device's appearance (prefers-color-scheme), else the brand's dark. */
export function resolveTheme(saved: unknown, prefersLight = false): Theme {
  return isTheme(saved) ? saved : prefersLight ? "light" : "dark";
}

/**
 * Runs in <head> before first paint so the page never flashes the other theme (data-theme on <html>, and
 * data-theme-choice for the switch). Kept dependency-free: it is inlined as a string and hashed into the CSP
 * (scripts/csp.ts), so any change here is picked up by the next build.
 */
export const THEME_SCRIPT = `(function(){
var s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}
var c=s==="light"||s==="dark"?s:"system";
var l=c==="light"||(c==="system"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches);
var d=document.documentElement;d.dataset.theme=l?"light":"dark";d.dataset.themeChoice=c;
})();`;
