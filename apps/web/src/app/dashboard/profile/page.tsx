"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { C } from "@/app/lib/theme";

type ProfileResponse = { 
  user: { name: string; email: string; grade: number; role: string; locale: string; timezone: string; createdAt?: string | null }; 
  subscription: { planName: string; isActive: boolean; startsAt?: string | null } 
};

export default function ProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [updatingLocale, setUpdatingLocale] = useState(false); // New state for loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/profile/me"), { headers: { ...getAuthHeaders() } });
        const payload = await parseJsonResponse<ProfileResponse & { detail?: string }>(res);
        if (cancelled) return;
        if (!res.ok) return setError(getApiErrorMessage(payload, "Failed to load profile."));
        setData(payload);
      } catch {
        if (!cancelled) setError("Failed to load profile.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 🚨 NEW: Language Update Handler 🚨
  const handleLocaleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value;
    setUpdatingLocale(true);
    
    try {
      const res = await fetch(getApiUrl("/api/profile/locale"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ locale: newLocale })
      });
      
      if (res.ok && data) {
        // Update local state so UI changes immediately
        setData({ ...data, user: { ...data.user, locale: newLocale } });
      } else {
        setError("Failed to update preferred language.");
      }
    } catch (err) {
      setError("An error occurred while updating language.");
    } finally {
      setUpdatingLocale(false);
    }
  };

  // Fixed your stray handleCancel function by bringing it inside the component!
  const handleCancel = async () => {
    // 1. Show the confirmation popup
    if (!confirm("Are you sure you want to cancel your Premium plan?")) return;
    
    try {
      // 2. Call the new backend endpoint
      const res = await fetch(getApiUrl("/api/profile/cancel-subscription"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() }
      });

      if (res.ok) {
        alert("Subscription cancelled. You are back on the Free plan.");
        window.location.reload(); // Refresh the page to show "Free"
      } else {
        // If the backend throws an error, catch and display it
        const errorData = await res.json();
        alert(`Failed to cancel: ${errorData.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Cancellation Error:", err);
      alert("A network error occurred while trying to cancel the subscription.");
    }
  };

  return (
    <div style={{ padding: "32px 40px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeUp 0.25s ease both" }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Profile ◈</h1>
        <p style={{ fontSize: 14, color: C.muted }}>Profile and subscription data are as per our records.</p>
      </div>
      
      {error && <div style={{ padding: 14, borderRadius: 12, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>{error}</div>}
      
      <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{data?.user.name || "--"}</div>
          <div style={{ marginTop: 8, color: C.muted }}>{data?.user.email || "--"}</div>
          
          <div style={{ marginTop: 16, display: "grid", gap: 12, fontSize: 14, alignItems: "center" }}>
            <div><strong>Standard:</strong> {data?.user.grade ?? "--"}</div>
            <div><strong>Role:</strong> {data?.user.role || "--"}</div>
            <div><strong>Timezone:</strong> {data?.user.timezone || "--"}</div>
            
            {/* 🚨 NEW: Interactive Language Dropdown 🚨 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>Tutor Language:</strong>
              <select 
                value={data?.user.locale || "en-IN"} 
                onChange={handleLocaleChange}
                disabled={updatingLocale}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", cursor: "pointer", background: "var(--input-bg)" }}
              >
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi (हिंदी)</option>
                <option value="ta-IN">Tamil (தமிழ்)</option>
                <option value="te-IN">Telugu (తెలుగు)</option>
              </select>
              {updatingLocale && <span style={{ fontSize: 12, color: C.primary }}>Saving...</span>}
            </div>
          </div>
        </section>

        <section style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 12, color: C.muted }}>Plan</div>
          <div style={{ fontSize: 24, fontWeight: 700, textTransform: "capitalize" }}>{data?.subscription.planName || "free"}</div>
          <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>Active: {data?.subscription.isActive ? "Yes" : "No"}</div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
            <button onClick={() => setShowPasswordModal(true)} style={actionButtonStyle}>Change password</button>
            {data?.subscription.planName !== "free" && (
              <button onClick={handleCancel} style={{...actionButtonStyle, color: "#b91c1c", background: "#fef2f2", borderColor: "#fecaca" }}>Cancel Subscription</button>
            )}
          </div>
        </section>
      </div>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

// Keep your modal intact below
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    const res = await fetch(getApiUrl("/api/auth/change-password"), { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ currentPassword, newPassword }) });
    const payload = await parseJsonResponse<{ detail?: string; message?: string }>(res);
    if (!res.ok) return setError(getApiErrorMessage(payload, "Failed to change password."));
    setSuccess(payload.message || "Password updated.");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 16, padding: 24, display: "grid", gap: 12 }}>
        <h3>Change password</h3>
        <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" type="password" style={inputStyle} />
        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" type="password" style={inputStyle} />
        <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" type="password" style={inputStyle} />
        {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        {success && <div style={{ color: C.secondary, fontSize: 13 }}>{success}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={onClose} style={buttonStyle}>Close</button><button type="submit" style={{ ...buttonStyle, background: C.primary, color: "white", borderColor: C.primary }}>Save</button></div>
      </form>
    </div>,
    document.body,
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)" };
const buttonStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.12)", background: "white", cursor: "pointer" };
const actionButtonStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "var(--input-bg)", cursor: "pointer", fontWeight: 500, transition: "0.2s" };