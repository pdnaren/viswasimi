import React from "react";
import Link from "next/link";
import { C, EASE } from "@/app/lib/theme";

export type ButtonVariant = "primary" | "ghost" | "outline" | "disabled";
export type ButtonSize = "sm" | "md" | "lg";

export function Button({
  children,
  variant = "primary",
  disabled = false,
  block = false,
  size = "md",
  onClick,
  href,
  type,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  disabled?: boolean;
  block?: boolean;
  size?: ButtonSize;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
}) {
  const base: React.CSSProperties = {
    fontFamily: "inherit",
    fontWeight: 600,
    borderRadius: 10,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: `all 0.25s ${EASE}`,
    width: block ? "100%" : undefined,
    padding: size === "lg" ? "14px 28px" : size === "sm" ? "7px 14px" : "10px 20px",
    fontSize: size === "lg" ? 16 : size === "sm" ? 13 : 14,
    textDecoration: "none",
  };
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      ...base,
      background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`,
      color: "#fff",
      boxShadow: `0 4px 18px ${C.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
    },
    ghost: { ...base, background: "transparent", color: C.muted, border: `1px solid ${C.border}` },
    outline: { ...base, background: "transparent", color: C.text, border: `1.5px solid rgba(0,0,0,0.15)` },
    disabled: { ...base, background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.25)", border: `1px solid rgba(0,0,0,0.08)`, cursor: "not-allowed" },
  };
  const classNames: Record<ButtonVariant, string> = {
    primary: "btn btn-primary",
    ghost: "btn btn-ghost",
    outline: "btn btn-outline",
    disabled: "btn",
  };
  const style = styles[variant];
  const className = classNames[variant];
  // Rendered as a Link (real <a>) when href is given, so we never nest a
  // <button> inside an <a> — that markup is invalid HTML and breaks
  // keyboard/screen-reader navigation.
  if (href && !disabled) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={className} style={style} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

// Shared hover micro-interactions for the classes assigned above. Include
// this once per page (via <style>{BUTTON_STYLES}</style>) wherever Button
// is used, since inline style objects can't express :hover.
export const BUTTON_STYLES = `
  .btn:not(:disabled):hover { transform: translateY(-2px); }
  .btn-primary:not(:disabled):hover { box-shadow: 0 8px 28px rgba(79,124,255,0.32), inset 0 1px 0 rgba(255,255,255,0.3); }
  .btn-ghost:not(:disabled):hover { background: rgba(79,124,255,0.07); border-color: rgba(79,124,255,0.25); color: ${C.text}; }
  .btn-outline:not(:disabled):hover { border-color: ${C.primary}; color: ${C.primary}; background: rgba(79,124,255,0.05); }
`;
