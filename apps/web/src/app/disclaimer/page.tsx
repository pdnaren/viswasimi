"use client";

import React from "react";
import Link from "next/link";

export default function DisclaimerPage() {
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
          AI Disclaimer
        </h1>

        <p style={{ fontSize: 14, color: "#6b7280" }}>
          Last Updated: April 2026
        </p>

        <Section title="1. Educational Assistance Only">
          Viswasimi AI Tutor provides AI-generated explanations intended for
          educational assistance only. The platform is designed to support
          learning but does not replace professional academic instruction.
        </Section>

        <Section title="2. Accuracy of Information">
          While we strive to provide accurate explanations, AI-generated
          responses may occasionally contain errors or incomplete information.
          Users are encouraged to verify important answers independently.
        </Section>

        <Section title="3. No Academic Guarantee">
          Viswasimi AI Tutor does not guarantee:

          <ul>
            <li>Academic success</li>
            <li>Improved grades</li>
            <li>Exam performance</li>
            <li>Admission results</li>
          </ul>
        </Section>

        <Section title="4. User Responsibility">
          Users are responsible for reviewing AI-generated content and ensuring
          correctness before relying on it for academic use.
        </Section>

        <Section title="5. Uploaded Content">
          Uploaded questions and answers are processed automatically by AI
          systems. Users should review results carefully before final use.
        </Section>

        <Section title="6. Limitation of Liability">
          Viswasimi AI Tutor shall not be liable for:

          <ul>
            <li>Incorrect AI-generated responses</li>
            <li>Academic performance outcomes</li>
            <li>Misinterpretation of AI explanations</li>
          </ul>
        </Section>

        <Section title="7. Changes to Disclaimer">
          This disclaimer may be updated periodically. Updates will be posted on
          this page.
        </Section>

        <Section title="8. Contact">
          contact@viswasimi.com  
          <br />
          Delhi, India
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