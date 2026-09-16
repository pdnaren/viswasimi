import React from "react";
import { C } from "@/app/lib/theme";

export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
  ];
  if (!password) return null;
  const score = checks.filter(c => c.pass).length;
  const colors = [C.red, C.amber, C.secondary];
  const labels = ["Weak", "Fair", "Strong"];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 99,
            background: i < score ? colors[score - 1] : "rgba(0,0,0,0.08)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {checks.map(c => (
            <span key={c.label} style={{ fontSize: 11, color: c.pass ? C.secondary : C.muted, display: "flex", alignItems: "center", gap: 3, transition: "color 0.2s" }}>
              <span>{c.pass ? "✓" : "○"}</span>{c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: colors[score - 1] }}>{labels[score - 1]}</span>}
      </div>
    </div>
  );
}
