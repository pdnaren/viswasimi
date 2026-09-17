"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, authCardStyle } from "@/app/components/auth/AuthShell";
import { C } from "@/app/lib/theme";
import { persistSessionToken } from "@/app/lib/auth-client";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) return;
    persistSessionToken(token);
    router.replace("/dashboard");
  }, [token, router]);

  if (!token) {
    return (
      <div style={{ ...authCardStyle, padding: "48px 32px", textAlign: "center" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10, color: C.text }}>Sign-in failed</h2>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>Missing sign-in token. Please try again.</p>
        <Link href="/login" className="text-link">Back to login</Link>
      </div>
    );
  }

  return (
    <div style={{ ...authCardStyle, padding: "48px 32px", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <div style={{ width: 20, height: 20, border: `2px solid rgba(79,124,255,0.18)`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: C.text }}>Signing you in…</h2>
      <p style={{ fontSize: 13, color: C.muted }}>Redirecting to your dashboard.</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <AuthShell backHref="/login" backLabel="← Back to login">
      <Suspense fallback={<div style={{ ...authCardStyle, padding: "48px 32px", textAlign: "center" }}>Loading…</div>}>
        <GoogleCallbackContent />
      </Suspense>
    </AuthShell>
  );
}
