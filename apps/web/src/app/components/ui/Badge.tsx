import React from "react";
import { C } from "@/app/lib/theme";

export function Badge({ children, color = C.primary }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: "inline-block",
      background: `${color}18`,
      color,
      border: `1px solid ${color}33`,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      padding: "3px 10px",
    }}>
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, marginBottom: 12 }}>
      {children}
    </p>
  );
}
