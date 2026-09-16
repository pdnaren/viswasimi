"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, authCardStyle } from "@/app/components/auth/AuthShell";
import { PasswordStrength } from "@/app/components/ui/PasswordStrength";
import { C } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, parseJsonResponse } from "@/app/lib/auth-client";

type Stage = "idle" | "loading" | "success" | "invalid_token";

type ResetPasswordResponse = { error?: string; detail?: string; message?: string };

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStage("invalid_token");
      return;
    }

    let cancelled = false;
    setStage("loading");

    (async () => {
      try {
        const validateUrl = `${getApiUrl("/api/auth/reset-password/validate")}?token=${encodeURIComponent(token)}`;
        const res = await fetch(validateUrl);
        const data = await parseJsonResponse<ResetPasswordResponse>(res);
        if (cancelled) return;
        if (!res.ok) {
          setError(getApiErrorMessage(data, "Invalid or expired token."));
          setStage("invalid_token");
          return;
        }
        setError(null);
        setStage("idle");
      } catch (error) {
        if (cancelled) return;
        setError(getFetchErrorMessage(error, `${getApiUrl("/api/auth/reset-password/validate")}?token=${encodeURIComponent(token)}`));
        setStage("invalid_token");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setStage("loading");
    try {
      const resetPasswordUrl = getApiUrl("/api/auth/reset-password");
      const res = await fetch(resetPasswordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await parseJsonResponse<ResetPasswordResponse>(res);
      if (!res.ok) {
        const message = getApiErrorMessage(data, "Something went wrong.");
        if (res.status === 400 && message.toLowerCase().includes("token")) {
          setError(message);
          setStage("invalid_token");
        } else {
          setError(message);
          setStage("idle");
        }
        return;
      }
      setStage("success");
      setTimeout(() => router.push("/login"), 3000);
    } catch (error) {
      setError(getFetchErrorMessage(error, getApiUrl("/api/auth/reset-password")));
      setStage("idle");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    paddingRight: 42,
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
    <AuthShell backHref="/login" backLabel="← Back to login" trustBadges={["🔒 Encrypted", "⏱ Link valid 30 min", "✦ One-time use"]}>
      {/* INVALID TOKEN */}
      {stage === "invalid_token" && (
        <div style={{ ...authCardStyle, border: `1px solid rgba(239,68,68,0.2)`, padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(239,68,68,0.08), inset 0 1px 0 rgba(255,255,255,0.6)", animation: "popIn 0.5s ease both" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(239,68,68,0.08)", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✗</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10, color: C.text }}>Link expired or invalid</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.75, marginBottom: 24 }}>This password reset link has expired or already been used. Reset links are valid for 30 minutes.</p>
          <Link href="/forgot-password" style={{ display: "inline-block", padding: "12px 24px", background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`, color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 18px rgba(79,124,255,0.28)" }}>
            Request a new link →
          </Link>
          <p style={{ marginTop: 16, fontSize: 13, color: C.muted }}>
            Remembered it? <Link href="/login" className="text-link">Back to login</Link>
          </p>
        </div>
      )}

      {/* SUCCESS */}
      {stage === "success" && (
        <div style={{ ...authCardStyle, border: `1px solid rgba(0,184,150,0.22)`, padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,184,150,0.10), inset 0 1px 0 rgba(255,255,255,0.6)", animation: "popIn 0.5s ease both" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(0,184,150,0.08)", border: `2px solid ${C.secondary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", color: C.secondary }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10, color: C.text }}>Password updated!</h2>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.75, marginBottom: 6 }}>Your password has been changed successfully.</p>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Redirecting you to login…</p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, border: `2px solid rgba(0,184,150,0.25)`, borderTopColor: C.secondary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        </div>
      )}

      {/* FORM */}
      {stage === "loading" && !!token ? (
        <div style={{ ...authCardStyle, padding: "48px 32px", textAlign: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <div style={{ width: 20, height: 20, border: `2px solid rgba(79,124,255,0.18)`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: C.text }}>Checking your reset link…</h2>
          <p style={{ fontSize: 13, color: C.muted }}>Please wait while we verify your token.</p>
        </div>
      ) : (stage === "idle" || stage === "loading") && (
        <div style={{ ...authCardStyle, boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg,${C.primary},${C.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 14px", boxShadow: `0 8px 24px ${C.glow}` }}>
              🔐
            </div>
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: C.text }}>Set new password</h1>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, maxWidth: 300, margin: "0 auto" }}>
              Choose a strong password for your Viswasimi account.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.20)", padding: "11px 14px", borderRadius: 10, marginBottom: 18, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>{error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* New password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 2 }}>New password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="vs-input"
                  style={inputStyle}
                  type={showPass ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
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
              <PasswordStrength password={password} />
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 2 }}>Confirm new password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="vs-input"
                  style={{
                    ...inputStyle,
                    borderColor: confirm && password !== confirm ? "rgba(239,68,68,0.5)" : undefined,
                  }}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="show-pass-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  aria-pressed={showConfirm}
                >
                  <span aria-hidden="true">{showConfirm ? "🙈" : "👁"}</span>
                </button>
              </div>
              {confirm && password !== confirm && (
                <p style={{ fontSize: 12, color: "#dc2626", marginTop: 5 }}>⚠ Passwords do not match</p>
              )}
              {confirm && password === confirm && password.length >= 8 && (
                <p style={{ fontSize: 12, color: C.secondary, marginTop: 5 }}>✓ Passwords match</p>
              )}
            </div>

            <button type="submit" disabled={stage === "loading"} className="submit-btn" style={{ marginTop: 4 }}>
              {stage === "loading" ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  Updating password…
                </span>
              ) : "Update password →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: C.muted }}>
            Remembered it? <Link href="/login" className="text-link">Back to login</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora',sans-serif", color: "#6b7280", fontSize: 14 }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
