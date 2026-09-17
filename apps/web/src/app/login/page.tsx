"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, authCardStyle } from "@/app/components/auth/AuthShell";
import { C } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, getGoogleErrorMessage, parseJsonResponse, persistSessionToken } from "@/app/lib/auth-client";

const EXTRA_STYLES = `
  .forgot-link { color: ${C.muted}; font-size: 13px; transition: color 0.2s; text-decoration: none; }
  .forgot-link:hover { color: ${C.primary}; }
`;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const displayError = submitError ?? getGoogleErrorMessage(searchParams.get("error"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      setLoading(true);
      const loginUrl = getApiUrl("/api/auth/login");
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseJsonResponse<{ sessionToken?: string; error?: string; detail?: string }>(res);
      if (!res.ok) { setSubmitError(getApiErrorMessage(data, "Login failed")); return; }
      if (data.sessionToken) {
        persistSessionToken(data.sessionToken);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setSubmitError(getFetchErrorMessage(err, getApiUrl("/api/auth/login")));
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
    <AuthShell
      backHref="/"
      backLabel="← Back to home"
      extraStyles={EXTRA_STYLES}
      trustBadges={["🔒 Secure login", "✦ Classes 6–12", "⚡ Free to start"]}
    >
      <div style={{ ...authCardStyle, boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
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
        {displayError && (
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
            {displayError}
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

        <a className="social-btn" href={getApiUrl("/api/auth/google/login")} style={{ textDecoration: "none" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </a>

        {/* Sign up link */}
        <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: C.muted }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-link">Create one free</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f4f6fb" }} />}>
      <LoginForm />
    </Suspense>
  );
}
