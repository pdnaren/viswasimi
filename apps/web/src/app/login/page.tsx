"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/app/components/brand-logo";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, parseJsonResponse, persistSessionToken } from "@/app/lib/auth-client";

const C = {
  bg: "#f4f6fb",
  surface: "#ffffff",
  card: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  primary: "#4f7cff",
  secondary: "#00b896",
  amber: "#f59e0b",
  text: "#111827",
  muted: "#6b7280",
  glow: "rgba(79,124,255,0.18)",
} as const;

function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "fixed",
        borderRadius: "50%",
        filter: "blur(90px)",
        opacity: 0.18,
        pointerEvents: "none",
        zIndex: 0,
        ...style,
      }}
    />
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const loginUrl = getApiUrl("/api/auth/login");
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonResponse<{ sessionToken?: string; error?: string; detail?: string }>(res);
      if (!res.ok) { setError(getApiErrorMessage(data, "Login failed")); return; }
      if (data.sessionToken) {
        persistSessionToken(data.sessionToken);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(getFetchErrorMessage(error, getApiUrl("/api/auth/login")));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "#f9fafb",
    border: `1px solid rgba(0,0,0,0.10)`,
    borderRadius: 10,
    color: C.text,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    marginTop: 6,
  };

  return (
    <div style={{
      fontFamily: "'Sora','Segoe UI',sans-serif",
      background: C.bg,
      color: C.text,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .vs-input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(79,124,255,0.12) !important; }
        .vs-input::placeholder { color: #9ca3af; }
        .forgot-link { color: ${C.muted}; font-size: 13px; transition: color 0.2s; text-decoration: none; }
        .forgot-link:hover { color: ${C.primary}; }
        .signup-link { color: ${C.primary}; font-weight: 600; text-decoration: none; transition: opacity 0.2s; }
        .signup-link:hover { opacity: 0.8; text-decoration: underline; }
        .nav-logo-link { text-decoration: none; color: inherit; display: inline-flex; align-items: center; }
        .back-link { color: ${C.muted}; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .back-link:hover { color: ${C.text}; }
        .show-pass-btn { background: none; border: none; cursor: pointer; color: ${C.muted}; font-size: 18px; line-height: 1; padding: 0 4px; transition: color 0.2s; }
        .show-pass-btn:hover { color: ${C.text}; }
        .submit-btn { width: 100%; padding: 13px; border-radius: 10px; border: none; background: linear-gradient(135deg, ${C.primary}, #3d63e0); color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: all 0.25s cubic-bezier(0.16,1,0.3,1); box-shadow: 0 4px 18px rgba(79,124,255,0.28), inset 0 1px 0 rgba(255,255,255,0.25); letter-spacing: -0.01em; }
        .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,124,255,0.38), inset 0 1px 0 rgba(255,255,255,0.3); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
        .divider::before, .divider::after { content:''; flex:1; height:1px; background: rgba(0,0,0,0.08); }
        .divider span { font-size: 12px; color: ${C.muted}; white-space: nowrap; }
        .social-btn { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.09); background: #f9fafb; color: ${C.text}; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .social-btn:hover { background: #f0f3fa; border-color: rgba(0,0,0,0.15); }
      `}</style>

      {/* Orbs — soft pastel on light bg */}
      <FloatingOrb style={{ width: 500, height: 500, background: C.primary, top: -200, left: -150 }} />
      <FloatingOrb style={{ width: 380, height: 380, background: C.secondary, bottom: -100, right: -100 }} />

      {/* NAV */}
      <header style={{
        position: "relative",
        zIndex: 10,
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid rgba(0,0,0,0.07)`,
        backdropFilter: "blur(20px)",
        background: "rgba(244,246,251,0.8)",
      }}>
        <Link href="/" className="nav-logo-link">
          <BrandLogo size={34} textSize={18} />
        </Link>
        <Link href="/" className="back-link">← Back to home</Link>
      </header>

      {/* MAIN */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 24px 60px",
        position: "relative",
        zIndex: 1,
        overflowY: "auto",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 420,
          animation: mounted ? "fadeUp 0.5s ease both" : "none",
        }}>

          {/* Card */}
          <div style={{
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: `1px solid rgba(255,255,255,0.6)`,
            borderRadius: 22,
            padding: "36px 32px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                margin: "0 auto 16px",
                boxShadow: `0 8px 24px ${C.glow}`,
              }}>
                🎓
              </div>
              <h1 style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: 6,
                color: C.text,
              }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 14, color: C.muted }}>
                Log in to continue learning
              </p>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" style={{
                background: "rgba(239,68,68,0.08)",
                color: "#dc2626",
                border: "1px solid rgba(239,68,68,0.2)",
                padding: "11px 14px",
                borderRadius: 10,
                marginBottom: 18,
                fontSize: 13,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}>
                <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 2 }}>
                  Email address
                </label>
                <input
                  className="vs-input"
                  style={inputStyle}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Password</label>
                  <Link href="/forgot-password" className="forgot-link">Forgot password?</Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    className="vs-input"
                    style={{ ...inputStyle, paddingRight: 15 }}
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="show-pass-btn"
                    onClick={() => setShowPass(!showPass)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    aria-pressed={showPass}
                  >
                    <span aria-hidden="true">{showPass ? "🙈" : "👁"}</span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop: 4 }}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    Logging in...
                  </span>
                ) : "Log in →"}
              </button>
            </form>

            {/* Divider */}
            <div className="divider"><span>or continue with</span></div>

            {/* Google SSO — not wired up on the backend yet, so kept visibly disabled
                instead of silently doing nothing when clicked. */}
            <button className="social-btn" type="button" disabled aria-disabled="true" title="Google sign-in is coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google (coming soon)
            </button>

            {/* Sign up link */}
            <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: C.muted }}>
              Don't have an account?{" "}
              <Link href="/signup" className="signup-link">Create one free</Link>
            </p>
          </div>

          {/* Trust badges */}
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 22, flexWrap: "wrap" }}>
            {["🔒 Secure login", "✦ Classes 6–12", "⚡ Free to start"].map(t => (
              <span key={t} style={{ fontSize: 12, color: C.muted }}>{t}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
