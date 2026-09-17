"use client";

import React, { useEffect, useState } from "react";

const STORAGE_KEY = "viswasimi-theme";

function getStoredTheme(): "light" | "dark" | null {
  if (typeof document === "undefined") return null;
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : null;
}

export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  // Lazy-init from the DOM attribute the anti-flash script in layout.tsx
  // already set before first paint, so this never causes a flash/mismatch.
  const [theme, setTheme] = useState<"light" | "dark" | null>(() => getStoredTheme());

  useEffect(() => {
    // Picks up the actual resolved theme once mounted, in case the initial
    // state was null (SSR) or the OS preference applied with no stored choice.
    void (async () => {
      setTheme(getStoredTheme() || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    })();
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme just won't persist across visits.
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)",
        background: "var(--surface)", color: "var(--text)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.2s, border-color 0.2s, transform 0.15s",
        flexShrink: 0,
        ...style,
      }}
    >
      {isDark ? (
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M15.66 4.34l-1.42 1.42M5.76 14.24l-1.42 1.42M15.66 15.66l-1.42-1.42M5.76 5.76 4.34 4.34" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M17.5 11.2A7.5 7.5 0 118.8 2.5a6 6 0 008.7 8.7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
