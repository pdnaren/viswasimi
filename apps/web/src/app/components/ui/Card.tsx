"use client";

import React, { useState } from "react";
import { EASE, GLASS } from "@/app/lib/theme";

export function Card({
  children,
  style,
  featured,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  featured?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...GLASS,
        background: featured ? "linear-gradient(145deg,rgba(232,238,255,0.85),rgba(240,244,255,0.75))" : GLASS.background,
        border: `1px solid ${featured ? "rgba(79,124,255,0.35)" : hovered ? "rgba(79,124,255,0.3)" : "rgba(255,255,255,0.6)"}`,
        borderRadius: 18,
        padding: "28px 24px",
        transition: `all 0.3s ${EASE}`,
        transform: hovered && !featured ? "translateY(-4px)" : "none",
        boxShadow: featured
          ? `0 0 0 1px rgba(79,124,255,0.2), 0 16px 44px rgba(79,124,255,0.14), inset 0 1px 0 rgba(255,255,255,0.6)`
          : hovered ? "0 16px 44px rgba(16,24,40,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" : GLASS.boxShadow,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
