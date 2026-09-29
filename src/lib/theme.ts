export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "vvake-theme";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

/** The visitor's saved choice, otherwise the brand's dark (the OS setting is not followed). */
export function resolveTheme(saved: unknown): Theme {
  return isTheme(saved) ? saved : "dark";
}

/**
 * Runs in <head> before first paint so the page never flashes the other theme.
 * Kept dependency-free: it is inlined as a string.
 */
export const THEME_SCRIPT = `(function(){
var saved=null;try{saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}
document.documentElement.dataset.theme=saved==="light"?"light":"dark";
})();`;
