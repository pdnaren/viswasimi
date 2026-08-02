"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/app/components/brand-logo";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, parseJsonResponse } from "@/app/lib/auth-client";

const C = {
  bg: "#f4f6fb",
  card: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  primary: "#4f7cff",
  secondary: "#00b896",
  text: "#111827",
  muted: "#6b7280",
  glow: "rgba(79,124,255,0.18)",
} as const;

type Stage = "idle" | "loading" | "sent";

type ForgotPasswordResponse = {
  message?: string;
  resetLink?: string;
  resetToken?: string;
  delivery?: string;
  error?: string;
  detail?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [previewResetLink, setPreviewResetLink] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("loading");
    try {
      const forgotPasswordUrl = getApiUrl("/api/auth/forgot-password");
      const res = await fetch(forgotPasswordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await parseJsonResponse<ForgotPasswordResponse>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "Something went wrong."));
        setStage("idle");
        return;
      }
      setPreviewResetLink(data.resetLink ?? null);
      setStage("sent");
    } catch (error) {
      setError(getFetchErrorMessage(error, getApiUrl("/api/auth/forgot-password")));
      setStage("idle");
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
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes popIn { 0%{opacity:0;transform:scale(0.85)} 60%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
        @keyframes drawCheck { from{stroke-dashoffset:30} to{stroke-dashoffset:0} }
        .vs-input:focus { border-color:${C.primary}!important; box-shadow:0 0 0 3px rgba(79,124,255,0.12)!important; }
        .vs-input::placeholder { color:#9ca3af; }
        .submit-btn { width:100%; padding:13px; border-radius:10px; border:none; background:${C.primary}; color:#fff; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 18px rgba(79,124,255,0.28); }
        .submit-btn:hover:not(:disabled) { background:#6b90ff; transform:translateY(-1px); box-shadow:0 8px 28px rgba(79,124,255,0.38); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .back-link { color:${C.muted}; font-size:13px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; transition:color 0.2s; }
        .back-link:hover { color:${C.text}; }
        .nav-logo-link { text-decoration:none; color:inherit; display:inline-flex; align-items:center; }
        .text-link { color:${C.primary}; font-weight:600; text-decoration:none; transition:opacity 0.2s; }
        .text-link:hover { opacity:0.75; text-decoration:underline; }
        .retry-btn { background:none; border:none; color:${C.primary}; font-size:13px; font-family:inherit; cursor:pointer; font-weight:600; padding:0; transition:opacity 0.2s; }
        .retry-btn:hover { opacity:0.75; }
        .check-path { stroke-dasharray:30; stroke-dashoffset:30; animation:drawCheck 0.5s 0.5s ease forwards; }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position:"fixed", borderRadius:"50%", filter:"blur(90px)", opacity:0.16, pointerEvents:"none", zIndex:0, width:400, height:400, background:C.primary, top:-120, left:-80 }} />
      <div style={{ position:"fixed", borderRadius:"50%", filter:"blur(80px)", opacity:0.14, pointerEvents:"none", zIndex:0, width:350, height:350, background:C.secondary, bottom:-80, right:-60 }} />

      {/* NAV */}
      <header style={{
        position:"relative", zIndex:10, padding:"18px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom:`1px solid rgba(0,0,0,0.07)`,
        backdropFilter:"blur(20px)",
        background:"rgba(244,246,251,0.8)",
      }}>
        <Link href="/" className="nav-logo-link">
          <BrandLogo size={34} textSize={18} />
        </Link>
        <Link href="/login" className="back-link">← Back to login</Link>
      </header>

      {/* MAIN */}
      <main style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"48px 24px 60px", position:"relative", zIndex:1, overflowY:"auto" }}>
        <div style={{ width:"100%", maxWidth:420, animation:mounted ? "fadeUp 0.5s ease both" : "none" }}>

          {stage === "sent" ? (
            /* ── SENT STATE ── */
            <div style={{
              background: C.card,
              border: `1px solid rgba(0,184,150,0.22)`,
              borderRadius: 22,
              padding: "48px 32px",
              textAlign: "center",
              boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,184,150,0.10)",
              animation: "popIn 0.5s ease both",
            }}>
              <div style={{
                width:72, height:72, borderRadius:"50%",
                background:"rgba(0,184,150,0.08)",
                border:`2px solid ${C.secondary}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 22px",
              }}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                  <rect x="2" y="8" width="30" height="20" rx="3" stroke={C.secondary} strokeWidth="1.8" fill="none" />
                  <path d="M2 12l15 9 15-9" stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" fill="none" />
                  <path className="check-path" d="M10 19l4.5 4.5 9-9" stroke={C.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>

              <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:"-0.03em", marginBottom:10, color:C.text }}>Check your inbox</h2>
              <p style={{ color:C.muted, fontSize:14, lineHeight:1.75, marginBottom:10 }}>We sent a password reset link to</p>
              <div style={{
                display:"inline-block",
                background:"rgba(79,124,255,0.08)",
                border:`1px solid rgba(79,124,255,0.20)`,
                borderRadius:8, padding:"5px 14px",
                fontSize:14, fontWeight:600, color:C.text, marginBottom:24,
              }}>
                {email}
              </div>

              <div style={{
                background:"#f9fafb",
                border:`1px solid rgba(0,0,0,0.07)`,
                borderRadius:12, padding:"14px 18px",
                textAlign:"left", marginBottom:24,
              }}>
                <p style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>
                  Didn&apos;t get it?
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    "Check your spam or junk folder.",
                    "The link expires in 30 minutes.",
                    "Make sure you used the right email address.",
                  ].map((tip) => (
                    <div key={tip} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:5, height:5, borderRadius:"50%", background:C.primary, flexShrink:0, marginTop:6 }} />
                      <span style={{ fontSize:13, color:C.muted, lineHeight:1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {previewResetLink && (
                <div style={{
                  background:"rgba(79,124,255,0.08)",
                  border:`1px solid rgba(79,124,255,0.20)`,
                  borderRadius:12,
                  padding:"14px 16px",
                  textAlign:"left",
                  marginBottom:18,
                }}>
                  <p style={{ fontSize:11, fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }}>
                    Local preview link
                  </p>
                  <p style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:10 }}>
                    SMTP is not configured, so use this reset link directly while testing.
                  </p>
                  <a href={previewResetLink} className="text-link" style={{ wordBreak:"break-all" }}>
                    {previewResetLink}
                  </a>
                </div>
              )}

              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <button className="retry-btn" onClick={() => { setStage("idle"); setError(null); setEmail(""); setPreviewResetLink(null); }}>
                  ↺ Try a different email
                </button>
                <p style={{ fontSize:13, color:C.muted }}>
                  Remembered it?{" "}
                  <Link href="/login" className="text-link">Back to login</Link>
                </p>
              </div>
            </div>

          ) : (
            /* ── FORM STATE ── */
            <div style={{
              background: C.card,
              border: `1px solid rgba(0,0,0,0.07)`,
              borderRadius: 22,
              padding: "36px 32px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.08)",
            }}>
              <div style={{ textAlign:"center", marginBottom:26 }}>
                <div style={{
                  width:52, height:52, borderRadius:16,
                  background:`linear-gradient(135deg,${C.primary},${C.secondary})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, margin:"0 auto 14px",
                  boxShadow:`0 8px 24px ${C.glow}`,
                }}>
                  🔑
                </div>
                <h1 style={{ fontSize:23, fontWeight:800, letterSpacing:"-0.03em", marginBottom:8, color:C.text }}>
                  Forgot your password?
                </h1>
                <p style={{ fontSize:13, color:C.muted, lineHeight:1.65, maxWidth:300, margin:"0 auto" }}>
                  No worries. Enter your email and we&apos;ll send you a reset link right away.
                </p>
              </div>

              {error && (
                <div style={{
                  background:"rgba(239,68,68,0.08)", color:"#dc2626",
                  border:"1px solid rgba(239,68,68,0.20)",
                  padding:"11px 14px", borderRadius:10, marginBottom:18,
                  fontSize:13, display:"flex", gap:8, alignItems:"flex-start",
                }}>
                  <span style={{ flexShrink:0, marginTop:1 }}>⚠</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:18 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:2 }}>
                    Email address
                  </label>
                  <input
                    className="vs-input"
                    style={inputStyle}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <button type="submit" disabled={stage === "loading"} className="submit-btn">
                  {stage === "loading" ? (
                    <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                      <span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }} />
                      Sending reset link…
                    </span>
                  ) : "Send reset link →"}
                </button>
              </form>

              <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
                <span style={{ fontSize:12, color:C.muted }}>or</span>
                <div style={{ flex:1, height:1, background:"rgba(0,0,0,0.08)" }} />
              </div>

              <p style={{ textAlign:"center", fontSize:13, color:C.muted }}>
                Remembered it?{" "}
                <Link href="/login" className="text-link">Back to login</Link>
              </p>
              <p style={{ textAlign:"center", fontSize:13, color:C.muted, marginTop:8 }}>
                New here?{" "}
                <Link href="/signup" className="text-link">Create a free account</Link>
              </p>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:20, flexWrap:"wrap" }}>
            {["🔒 Encrypted link", "⏱ Expires in 30 min", "✦ No spam ever"].map((t) => (
              <span key={t} style={{ fontSize:12, color:C.muted }}>{t}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
