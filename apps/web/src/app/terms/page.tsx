"use client";

import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div
      style={{
        fontFamily: "'Sora','Segoe UI',sans-serif",
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        padding: "80px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "var(--card)",
          borderRadius: 16,
          padding: "40px 32px",
          border: "1px solid var(--border)",
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
          Terms of Service
        </h1>

        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Last Updated: April 2026
        </p>

        <Section title="1. Eligibility">
          Users must be at least 13 years old or use the platform under
          parental supervision.
        </Section>

        <Section title="2. Description of Services">
          Viswasimi AI Tutor provides AI-powered tutoring, assessments,
          analytics, and file evaluation services.
        </Section>

        <Section title="3. User Responsibilities">
          Users agree to provide accurate information and maintain account
          security.
        </Section>

        <Section title="4. Acceptable Use">
          Users must not upload harmful, illegal, or abusive content.
        </Section>

        <Section title="5. Subscription & Payments">
          Paid features are billed monthly using Razorpay payment processing.
        </Section>

        <Section title="6. Refund Policy">
          Refunds are handled on a case-by-case basis depending on the issue.
        </Section>

        <Section title="7. AI Disclaimer">
          AI-generated responses may contain inaccuracies. Users should verify
          important information.
        </Section>

        <Section title="8. Termination">
          Accounts may be suspended for misuse or policy violations.
        </Section>

        <Section title="9. Governing Law">
          These terms are governed by the laws of Delhi, India.
        </Section>

        <Section title="10. Contact">
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
    <div style={{ marginTop: 24 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          fontSize: 14,
          color: "var(--text)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </p>
    </div>
  );
}