"use client";

import React from "react";
import Link from "next/link";

export default function CookiesPolicyPage() {
  return (
    <div
      style={{
        fontFamily: "'Sora','Segoe UI',sans-serif",
        background: "#f4f6fb",
        color: "#111827",
        minHeight: "100vh",
        padding: "80px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: 16,
          padding: "40px 32px",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <Link href="/" style={{ fontSize: 14, color: "#4f7cff" }}>
          ← Back to Home
        </Link>

        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            marginTop: 10,
          }}
        >
          Cookies Policy
        </h1>

        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Last Updated: April 2026
        </p>

        <Section title="1. What Are Cookies">
          Cookies are small text files stored on your device to improve user
          experience and maintain login sessions.
        </Section>

        <Section title="2. How We Use Cookies">
          We use cookies to:

          <ul>
            <li>Maintain login sessions</li>
            <li>Remember user preferences</li>
            <li>Improve platform performance</li>
            <li>Analyze usage patterns</li>
          </ul>
        </Section>

        <Section title="3. Types of Cookies Used">
          <ul>
            <li>Essential Cookies – required for platform functionality</li>
            <li>Performance Cookies – help improve system speed</li>
            <li>Analytics Cookies – help understand user behavior</li>
          </ul>
        </Section>

        <Section title="4. Managing Cookies">
          Users can disable cookies through browser settings. However, some
          features may not function properly if cookies are disabled.
        </Section>

        <Section title="5. Changes to Cookies Policy">
          This Cookies Policy may be updated from time to time. Updates will be
          posted on this page.
        </Section>

        <Section title="6. Contact">
          contact@viswasimi.com
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 26 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          fontSize: 14,
          color: "#374151",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}