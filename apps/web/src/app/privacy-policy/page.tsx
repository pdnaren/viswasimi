"use client";

import React from "react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
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
          boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 30 }}>
          <Link href="/" style={{ fontSize: 14, color: "#4f7cff" }}>
            ← Back to Home
          </Link>

          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              marginTop: 10,
              marginBottom: 6,
            }}
          >
            Privacy Policy
          </h1>

          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Last Updated: April 2026
          </p>
        </div>

        {/* Content */}

        <Section title="1. Information We Collect">
          <p>
            We collect information such as name, email address, class details,
            and account information when users register on Viswasimi AI Tutor.
          </p>

          <p>
            We also collect student learning data including chat history,
            uploaded questions, answers generated, and performance analytics to
            improve learning experience.
          </p>
        </Section>

        <Section title="2. Uploaded Files">
          <p>
            Users may upload homework, question papers, or practice materials.
            These files are processed only to evaluate answers and provide
            learning guidance.
          </p>
        </Section>

        <Section title="3. How We Use Information">
          <ul>
            <li>Provide AI tutoring services</li>
            <li>Evaluate uploaded answers</li>
            <li>Track learning performance</li>
            <li>Improve AI responses</li>
            <li>Process payments securely</li>
          </ul>
        </Section>

        <Section title="4. Payment Processing">
          <p>
            Payments are securely handled using Razorpay. We do not store card
            or banking information on our servers.
          </p>
        </Section>

        <Section title="5. Children's Privacy">
          <p>
            Viswasimi AI Tutor is designed for students. Users under 18 must use
            the platform under parental or guardian supervision.
          </p>
        </Section>

        <Section title="6. Data Storage & Security">
          <p>
            We use secure servers and encrypted connections to protect user
            information including chat history and uploaded files.
          </p>
        </Section>

        <Section title="7. Data Retention">
          <p>
            User data is stored while the account remains active. Users may
            request account deletion at any time.
          </p>
        </Section>

        <Section title="8. Sharing of Information">
          <p>
            We do not sell user data. Data may be shared only with trusted
            services such as payment providers and cloud hosting systems.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            We use cookies to maintain login sessions and improve performance.
            Users may disable cookies through browser settings.
          </p>
        </Section>

        <Section title="10. User Rights">
          <p>
            Users may request access, updates, or deletion of their personal
            data by contacting us.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy periodically. Updates will be
            posted on this page.
          </p>
        </Section>

        <Section title="12. Contact Information">
          <p>Email: contact@viswasimi.com</p>
          <p>Location: Delhi, India</p>
          <p>Website: https://viswasimi.com</p>
        </Section>
      </div>
    </div>
  );
}

/* Reusable Section Component */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 26 }}>
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
          color: "var(--text)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}