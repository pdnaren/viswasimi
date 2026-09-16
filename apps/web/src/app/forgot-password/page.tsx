"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthShell, authCardStyle } from "@/app/components/auth/AuthShell";
import { C } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, parseJsonResponse } from "@/app/lib/auth-client";

const EXTRA_STYLES = `
  @keyframes drawCheck { from{stroke-dashoffset:30} to{stroke-dashoffset:0} }
  .retry-btn { background:none; border:none; color:${C.primary}; font-size:13px; font-family:inherit; cursor:pointer; font-weight:600; padding:0; transition:opacity 0.2s; }
  .retry-btn:hover { opacity:0.75; }
  .check-path { stroke-dasharray:30; stroke-dashoffset:30; animation:drawCheck 0.5s 0.5s ease forwards; }
`;

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
  const [previewResetLink, setPreviewResetLink] = useState<string | null>(null);

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
    <AuthShell
      backHref="/login"
      backLabel="← Back to login"
      extraStyles={EXTRA_STYLES}
      trustBadges={["🔒 Encrypted link", "⏱ Expires in 30 min", "✦ No spam ever"]}
    >
      {stage === "sent" ? (
        /* ── SENT STATE ── */
        <div style={{
          ...authCardStyle,
          border: `1px solid rgba(0,184,150,0.22)`,
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,184,150,0.10), inset 0 1px 0 rgba(255,255,255,0.6)",
          animation: "popIn 0.5s ease both",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(0,184,150,0.08)",
            border: `2px solid ${C.secondary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 22px",
          }}>
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <rect x="2" y="8" width="30" height="20" rx="3" stroke={C.secondary} strokeWidth="1.8" fill="none" />
              <path d="M2 12l15 9 15-9" stroke={C.secondary} strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path className="check-path" d="M10 19l4.5 4.5 9-9" stroke={C.secondary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10, color: C.text }}>Check your inbox</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.75, marginBottom: 10 }}>We sent a password reset link to</p>
          <div style={{
            display: "inline-block",
            background: "rgba(79,124,255,0.08)",
            border: `1px solid rgba(79,124,255,0.20)`,
            borderRadius: 8, padding: "5px 14px",
            fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 24,
          }}>
            {email}
          </div>

          <div style={{
            background: "#f9fafb",
            border: `1px solid rgba(0,0,0,0.07)`,
            borderRadius: 12, padding: "14px 18px",
            textAlign: "left", marginBottom: 24,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              Didn&apos;t get it?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Check your spam or junk folder.",
                "The link expires in 30 minutes.",
                "Make sure you used the right email address.",
              ].map((tip) => (
                <div key={tip} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary, flexShrink: 0, marginTop: 6 }} />
                  <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {previewResetLink && (
            <div style={{
              background: "rgba(79,124,255,0.08)",
              border: `1px solid rgba(79,124,255,0.20)`,
              borderRadius: 12,
              padding: "14px 16px",
              textAlign: "left",
              marginBottom: 18,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                Local preview link
              </p>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
                SMTP is not configured, so use this reset link directly while testing.
              </p>
              <a href={previewResetLink} className="text-link" style={{ wordBreak: "break-all" }}>
                {previewResetLink}
              </a>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="retry-btn" onClick={() => { setStage("idle"); setError(null); setEmail(""); setPreviewResetLink(null); }}>
              ↺ Try a different email
            </button>
            <p style={{ fontSize: 13, color: C.muted }}>
              Remembered it?{" "}
              <Link href="/login" className="text-link">Back to login</Link>
            </p>
          </div>
        </div>

      ) : (
        /* ── FORM STATE ── */
        <div style={{ ...authCardStyle, boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: `linear-gradient(135deg,${C.primary},${C.secondary})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, margin: "0 auto 14px",
              boxShadow: `0 8px 24px ${C.glow}`,
            }}>
              🔑
            </div>
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: C.text }}>
              Forgot your password?
            </h1>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, maxWidth: 300, margin: "0 auto" }}>
              No worries. Enter your email and we&apos;ll send you a reset link right away.
            </p>
          </div>

          {error && (
            <div role="alert" style={{
              background: "rgba(239,68,68,0.08)", color: "#dc2626",
              border: "1px solid rgba(239,68,68,0.20)",
              padding: "11px 14px", borderRadius: 10, marginBottom: 18,
              fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <button type="submit" disabled={stage === "loading"} className="submit-btn">
              {stage === "loading" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Sending reset link…
                </span>
              ) : "Send reset link →"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
            <span style={{ fontSize: 12, color: C.muted }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
          </div>

          <p style={{ textAlign: "center", fontSize: 13, color: C.muted }}>
            Remembered it?{" "}
            <Link href="/login" className="text-link">Back to login</Link>
          </p>
          <p style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 8 }}>
            New here?{" "}
            <Link href="/signup" className="text-link">Create a free account</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
