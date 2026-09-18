"use client";

import React from "react";
import Link from "next/link";

export default function RefundPolicyPage() {
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
          Refund & Cancellation Policy
        </h1>

        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Last Updated: April 2026
        </p>

        <Section title="1. Subscription Billing">
          Viswasimi AI Tutor offers monthly subscription plans billed through
          Razorpay. Charges apply based on the selected plan.
        </Section>

        <Section title="2. Cancellation Policy">
          Users may cancel their subscription at any time through their account
          dashboard.

          After cancellation:
          <ul>
            <li>Access remains active until the current billing period ends</li>
            <li>No further charges will be applied</li>
          </ul>
        </Section>

        <Section title="3. Refund Policy">
          Refunds are provided on a case-by-case basis.

          Refunds may be granted in situations such as:

          <ul>
            <li>Technical issues preventing platform usage</li>
            <li>Duplicate payments</li>
            <li>Billing errors</li>
            <li>Exceptional service failures</li>
          </ul>

          Refund decisions are made at the sole discretion of Viswasimi AI Tutor.
        </Section>

        <Section title="4. Non-Refundable Situations">
          Refunds may not be issued in cases such as:

          <ul>
            <li>Change of mind after subscription</li>
            <li>Partial usage of services</li>
            <li>User misunderstanding of features</li>
          </ul>
        </Section>

        <Section title="5. Refund Processing Time">
          Approved refunds are typically processed within:

          <strong>5–10 business days</strong>

          Processing time may vary depending on the payment provider.
        </Section>

        <Section title="6. Contact for Refund Requests">
          To request a refund, contact:

          <p>Email: contact@viswasimi.com</p>
          <p>Location: Delhi, India</p>
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
          color: "var(--text)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}