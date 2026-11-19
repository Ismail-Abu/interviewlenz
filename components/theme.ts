"use client";

import { useSyncExternalStore } from "react";
import { ACTIVE_KEY, THEME_KEY } from "./themeScript";

// Light/dark theme for signed-in users.
//
// The chosen theme is saved per browser in localStorage. It only takes effect
// while the "active" flag is set, which NavAuth sets when an SSOJet session is
// present and clears on sign-out or when no session is found. Signed-out
// visitors therefore always see the light theme. The <head> script in
// components/themeScript.ts applies the same rule before first paint.

export type Theme = "light" | "dark";

const CHANGED = "interviewlenz-theme-changed";

function readStored(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  window.dispatchEvent(new Event(CHANGED));
}

/** Called when a signed-in session is confirmed: turn the saved theme on. */
export function activateTheme() {
  try { localStorage.setItem(ACTIVE_KEY, "1"); } catch { /* storage blocked: theme lasts this page only */ }
  apply(readStored());
}

/** Called on sign-out or when no session exists: back to light. The saved choice is kept for next sign-in. */
export function deactivateTheme() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch { /* nothing to clear */ }
  apply("light");
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked: theme lasts this page only */ }
  apply(theme);
}

function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(refresh: () => void) {
  window.addEventListener(CHANGED, refresh);
  // Keep other tabs in step when the user toggles or signs out elsewhere.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY && e.key !== ACTIVE_KEY) return;
    let on = false;
    try { on = localStorage.getItem(ACTIVE_KEY) === "1"; } catch { /* ignore */ }
    apply(on ? readStored() : "light");
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, refresh);
    window.removeEventListener("storage", onStorage);
  };
}

/** The theme currently shown on the page. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
