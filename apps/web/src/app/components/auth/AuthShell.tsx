"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/app/components/brand-logo";
import { C, GLASS, GLASS_BORDER } from "@/app/lib/theme";

// CSS shared by every auth screen (login, signup, forgot/reset password).
// Page-specific extras (e.g. signup's grade picker) are passed via `extraStyles`.
const SHARED_AUTH_STYLES = `
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes popIn { 0%{opacity:0;transform:scale(0.85)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
  .vs-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(79,124,255,0.12) !important; }
  .vs-input::placeholder { color: #9ca3af; }
  .nav-logo-link { text-decoration: none; color: inherit; display: inline-flex; align-items: center; }
  .back-link { color: ${C.muted}; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: color 0.2s; }
  .back-link:hover { color: ${C.text}; }
  .text-link { color: ${C.primary}; font-weight: 600; text-decoration: none; transition: opacity 0.2s; }
  .text-link:hover { opacity: 0.8; text-decoration: underline; }
  .show-pass-btn { background: none; border: none; cursor: pointer; color: ${C.muted}; font-size: 17px; line-height: 1; padding: 0 4px; transition: color 0.2s; }
  .show-pass-btn:hover { color: ${C.text}; }
  .submit-btn { width: 100%; padding: 13px; border-radius: 10px; border: none; background: linear-gradient(135deg, ${C.primary}, ${C.primaryDeep}); color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 4px 18px rgba(79,124,255,0.28), inset 0 1px 0 rgba(255,255,255,0.25); letter-spacing: -0.01em; }
  .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,124,255,0.38), inset 0 1px 0 rgba(255,255,255,0.3); }
  .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
  .divider::before, .divider::after { content:''; flex:1; height:1px; background: rgba(0,0,0,0.08); }
  .divider span { font-size: 12px; color: ${C.muted}; white-space: nowrap; }
  .social-btn { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.09); background: #f9fafb; color: ${C.text}; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
  .social-btn:hover { background: #f0f3fa; border-color: rgba(0,0,0,0.15); }
`;

// Base look for the frosted card every auth screen renders — spread this
// into a page's own style object and override boxShadow for a state-specific
// accent glow (success green, error red, etc).
export const authCardStyle: React.CSSProperties = {
  ...GLASS,
  border: GLASS_BORDER,
  borderRadius: 22,
  padding: "36px 32px",
};

export function AuthShell({
  backHref = "/",
  backLabel = "← Back to home",
  maxWidth = 420,
  trustBadges,
  extraStyles = "",
  children,
}: {
  backHref?: string;
  backLabel?: string;
  maxWidth?: number;
  trustBadges?: string[];
  extraStyles?: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ fontFamily: "'Sora','Segoe UI',sans-serif", background: C.bg, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{SHARED_AUTH_STYLES + extraStyles}</style>

      {/* Ambient orbs */}
      <div aria-hidden="true" style={{ position: "fixed", borderRadius: "50%", filter: "blur(90px)", opacity: 0.16, pointerEvents: "none", zIndex: 0, width: 480, height: 480, background: C.primary, top: -180, left: -140 }} />
      <div aria-hidden="true" style={{ position: "fixed", borderRadius: "50%", filter: "blur(80px)", opacity: 0.14, pointerEvents: "none", zIndex: 0, width: 380, height: 380, background: C.secondary, bottom: -100, right: -80 }} />

      {/* NAV */}
      <header style={{
        position: "relative", zIndex: 10, padding: "18px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: "rgba(244,246,251,0.75)",
      }}>
        <Link href="/" className="nav-logo-link">
          <BrandLogo size={34} textSize={18} />
        </Link>
        <Link href={backHref} className="back-link">{backLabel}</Link>
      </header>

      {/* MAIN */}
      <main style={{
        flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "48px 24px 60px", position: "relative", zIndex: 1, overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth, animation: mounted ? "fadeUp 0.5s ease both" : "none" }}>
          {children}

          {trustBadges && trustBadges.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 22, flexWrap: "wrap" }}>
              {trustBadges.map(t => (
                <span key={t} style={{ fontSize: 12, color: C.muted }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
