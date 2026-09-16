"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, authCardStyle } from "@/app/components/auth/AuthShell";
import { PasswordStrength } from "@/app/components/ui/PasswordStrength";
import { C } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getFetchErrorMessage, parseJsonResponse, persistSessionToken } from "@/app/lib/auth-client";

const BOARDS = [
  { id: "CBSE", name: "CBSE" },
  { id: "ICSE", name: "ICSE" },
  { id: "STATE", name: "State Board" },
  { id: "JEE", name: "JEE (Engineering)" },
  { id: "NEET", name: "NEET (Medical)" },
];

const STATE_BOARDS = [
  "Bihar Board",
  "UP Board",
  "Maharashtra Board",
  "Rajasthan Board",
  "MP Board",
  "West Bengal Board",
  "Karnataka Board",
  "Gujarat Board",
  "Tamil Nadu Board",
  "Other State Board"
];

const TARGETS: Record<string, string[]> = {
  CBSE: ["6", "7", "8", "9", "10", "11", "12"],
  ICSE: ["6", "7", "8", "9", "10", "11", "12"],
  STATE: ["6", "7", "8", "9", "10", "11", "12"],
  JEE: ["2026 Target", "2027 Target", "Dropper"],
  NEET: ["2026 Target", "2027 Target", "Dropper"],
};

const EXTRA_STYLES = `
  @keyframes slideIn { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
  .grade-btn { border: 1.5px solid rgba(0,0,0,0.09); background: #f9fafb; color: ${C.muted}; border-radius: 10px; padding: 9px 6px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; transition: all 0.15s; text-align: center; }
  .grade-btn:hover { border-color: rgba(79,124,255,0.4); color: ${C.text}; background: rgba(79,124,255,0.06); }
  .grade-btn.selected { border-color: ${C.primary}; background: rgba(79,124,255,0.10); color: ${C.primary}; box-shadow: 0 0 0 1px rgba(79,124,255,0.25); }
  .next-btn { width:100%; padding:13px; border-radius:10px; border:none; background:linear-gradient(135deg, ${C.primary}, ${C.primaryDeep}); color:#fff; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; transition:all 0.25s cubic-bezier(0.16,1,0.3,1); box-shadow:0 4px 18px rgba(79,124,255,0.28), inset 0 1px 0 rgba(255,255,255,0.25); }
  .next-btn:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(79,124,255,0.38), inset 0 1px 0 rgba(255,255,255,0.3); }
  .step-back { background:none; border:none; color:${C.muted}; cursor:pointer; font-size:13px; font-family:inherit; display:inline-flex; align-items:center; gap:5px; padding:0; transition:color 0.2s; margin-bottom:18px; }
  .step-back:hover { color:${C.text}; }
`;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Dynamic curriculum selection state
  const [board, setBoard] = useState("");
  const [stateBoardName, setStateBoardName] = useState("");
  const [target, setTarget] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!board || !target || (board === "STATE" && !stateBoardName)) {
      setError("Please complete your educational selection.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const finalBoard = board === "STATE" ? stateBoardName : board;
    const standardizedGrade = `${finalBoard}-${target}`.toUpperCase();

    try {
      setLoading(true);
      const signupUrl = getApiUrl("/api/auth/signup");
      const res = await fetch(signupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, grade: standardizedGrade }),
      });
      const data = await parseJsonResponse<{ sessionToken?: string; error?: string; detail?: string }>(res);
      if (!res.ok) { setError(getApiErrorMessage(data, "Signup failed")); return; }
      if (data.sessionToken) {
        persistSessionToken(data.sessionToken);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(getFetchErrorMessage(err, getApiUrl("/api/auth/signup")));
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

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
    display: "block",
  };

  return (
    <AuthShell
      backHref="/"
      backLabel="← Back to home"
      maxWidth={440}
      extraStyles={EXTRA_STYLES}
      trustBadges={["🔒 Secure signup", "✦ Free forever plan", "⚡ No credit card"]}
    >
      {success ? (
        <div style={{
          ...authCardStyle,
          border: `1px solid rgba(0,184,150,0.25)`,
          padding: "52px 32px",
          textAlign: "center",
          boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,184,150,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
          animation: "popIn 0.5s ease both",
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%",
            background: "rgba(0,184,150,0.10)",
            border: `2px solid ${C.secondary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, margin: "0 auto 20px",
            animation: "popIn 0.4s 0.1s ease both",
            color: C.secondary,
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: C.text }}>Account created!</h2>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 6 }}>
            Welcome to Viswasimi, <strong style={{ color: C.text }}>{name}</strong>.
          </p>
          <p style={{ color: C.muted, fontSize: 13 }}>Creating your account and taking you to your dashboard…</p>
          <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, border: `2px solid rgba(0,184,150,0.25)`, borderTopColor: C.secondary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          </div>
        </div>
      ) : (
        <div style={{ ...authCardStyle, boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: s <= step ? C.primary : "rgba(0,0,0,0.08)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, margin: "0 auto 14px",
              boxShadow: `0 8px 24px ${C.glow}`,
            }}>
              {step === 1 ? "✨" : "🔐"}
            </div>
            <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 5, color: C.text }}>
              {step === 1 ? "Create your account" : "Set your password"}
            </h1>
            <p style={{ fontSize: 13, color: C.muted }}>
              {step === 1 ? "Step 1 of 2 — Tell us about yourself" : "Step 2 of 2 — Almost there!"}
            </p>
          </div>

          {error && (
            <div role="alert" style={{
              background: "rgba(239,68,68,0.08)", color: "#dc2626",
              border: "1px solid rgba(239,68,68,0.2)",
              padding: "11px 14px", borderRadius: 10, marginBottom: 18,
              fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "slideIn 0.3s ease both" }}>
                <div>
                  <label style={labelStyle}>Full name</label>
                  <input
                    className="vs-input"
                    style={inputStyle}
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Email address</label>
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

                <div>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>What are you preparing for?</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                    {BOARDS.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        className={`grade-btn${board === b.id ? " selected" : ""}`}
                        onClick={() => { setBoard(b.id); setTarget(""); setStateBoardName(""); setError(null); }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                {board === "STATE" && (
                  <div style={{ animation: "slideIn 0.3s ease both" }}>
                    <label style={labelStyle}>Select your State Board</label>
                    <select
                      style={inputStyle}
                      value={stateBoardName}
                      onChange={(e) => { setStateBoardName(e.target.value); setTarget(""); }}
                    >
                      <option value="">Choose state...</option>
                      {STATE_BOARDS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(board && (board !== "STATE" || stateBoardName)) && (
                  <div style={{ animation: "fadeUp 0.3s ease both" }}>
                    <label style={{ ...labelStyle, marginBottom: 8 }}>
                      {board.includes("JEE") || board.includes("NEET") ? "Select Target Year" : "Select your Class"}
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                      {TARGETS[board].map(t => (
                        <button
                          key={t}
                          type="button"
                          className={`grade-btn${target === t ? " selected" : ""}`}
                          onClick={() => { setTarget(t); setError(null); }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="next-btn"
                  style={{ marginTop: 4 }}
                  onClick={() => {
                    if (!name.trim()) { setError("Please enter your name."); return; }
                    if (!email.trim()) { setError("Please enter your email."); return; }
                    if (!board || !target || (board === "STATE" && !stateBoardName)) {
                      setError("Please complete your selection."); return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                >
                  Continue →
                </button>

                <div className="divider"><span>or sign up with</span></div>
                {/* Google SSO — not wired up on the backend yet, so kept visibly disabled
                    instead of silently doing nothing when clicked. */}
                <button className="social-btn" type="button" disabled aria-disabled="true" title="Google sign-up is coming soon" style={{ opacity: 0.55, cursor: "not-allowed" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google (coming soon)
                </button>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "slideIn 0.3s ease both" }}>
                <button type="button" className="step-back" onClick={() => { setStep(1); setError(null); }}>
                  ← Back
                </button>

                {/* Summary chip */}
                <div style={{
                  background: "rgba(79,124,255,0.06)",
                  border: "1px solid rgba(79,124,255,0.18)",
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", gap: 12, alignItems: "center",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0, color: "#fff", fontWeight: 700,
                  }}>
                    {name.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {board === "STATE" ? stateBoardName : board} · Class {target}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Create a password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="vs-input"
                      style={{ ...inputStyle, paddingRight: 15 }}
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
                      style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}
                      aria-label={showPass ? "Hide password" : "Show password"}
                      aria-pressed={showPass}
                    >
                      <span aria-hidden="true">{showPass ? "🙈" : "👁"}</span>
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <button type="submit" disabled={loading} className="submit-btn" style={{ marginTop: 2 }}>
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                      Creating account…
                    </span>
                  ) : "Create account →"}
                </button>
              </div>
            )}
          </form>

          <p style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: C.muted }}>
            Already have an account?{" "}
            <Link href="/login" className="text-link">Log in</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
