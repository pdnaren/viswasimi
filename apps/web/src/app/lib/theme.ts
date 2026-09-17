import type { CSSProperties } from "react";

// Single source of truth for the brand palette. Previously copy-pasted
// (with small drifts) into page.tsx, login/signup, forgot/reset-password —
// change a color here instead of hunting across files.
//
// Values reference the CSS custom properties defined in globals.css rather
// than literal hex, so every page using C automatically follows the
// light/dark toggle (see ThemeToggle.tsx) without needing a React re-render
// for color values — only the `data-theme` attribute on <html> changes.
export const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  card: "var(--card)",
  border: "var(--border)",
  primary: "#4f7cff",
  primaryDeep: "#3d63e0",
  secondary: "#00b896",
  amber: "#f59e0b",
  pink: "#f43f8e",
  red: "#ef4444",
  text: "var(--text)",
  muted: "var(--muted)",
  glow: "rgba(79,124,255,0.18)",
} as const;

// Smooth "ease-out-expo"-style curve used for hover/lift micro-interactions
// and scroll reveals, so motion feels consistent across the whole site.
export const EASE = "cubic-bezier(0.16,1,0.3,1)";

// Frosted-glass surface for cards — keeps the brand palette but adds depth
// against the ambient gradient orbs behind it.
export const GLASS: CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 16px 40px -12px rgba(16,24,40,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
};

export const GLASS_BORDER = "1px solid var(--glass-border)";
