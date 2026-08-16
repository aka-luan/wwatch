import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "wwatch-theme";
const EVENT = "wwatch:theme";
const THEME_COLOR = { light: "#f7f8fb", dark: "#0a0d12" } as const satisfies Record<Theme, string>;

/** Dark is the deliberate default (baked into index.html/login.html as class="dark"); light is an explicit opt-in. */
export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function updateThemeColorMeta(theme: Theme): void {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  updateThemeColorMeta(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage may be unavailable (private browsing, etc.) — theme still applies for this load
  }
  window.dispatchEvent(new CustomEvent<Theme>(EVENT, { detail: theme }));
}

/** Applies a stored preference over the shipped default. Call once, before the app renders. */
export function initTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (stored === "light" || stored === "dark") {
    document.documentElement.classList.toggle("dark", stored === "dark");
  }
  updateThemeColorMeta(currentTheme());
}

export function useTheme(): Theme {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === "undefined" ? "dark" : currentTheme(),
  );
  useEffect(() => {
    const handler = (event: Event) => setThemeState((event as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return theme;
}
