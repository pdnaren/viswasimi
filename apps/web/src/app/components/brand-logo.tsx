import Image from "next/image";
import React from "react";

type BrandLogoProps = {
  size?: number;
  textSize?: number;
  showText?: boolean;
  subtitle?: string;
  textColor?: string;
};

export function BrandLogo({
  size = 34,
  textSize = 20,
  showText = true,
  subtitle,
  textColor = "var(--text)",
}: BrandLogoProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Image
        src="/viswasimi-mark.svg"
        alt="Viswasimi logo"
        width={size}
        height={size}
        priority
        style={{ width: size, height: size }}
      />
      {showText && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 800, fontSize: textSize, letterSpacing: "-0.03em", color: textColor }}>
            VISWASIMI
          </span>
          {subtitle && (
            <span style={{ fontSize: Math.max(11, Math.round(textSize * 0.52)), color: "#1f3c75", letterSpacing: "0.01em" }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
