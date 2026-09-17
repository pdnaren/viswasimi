"use client";

import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

type LinkToken = { id: string; token: string; label: string | null; createdAt: string };

export default function ParentAccessPage() {
  const [links, setLinks] = useState<LinkToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => { await loadLinks(); })();
  }, []);

  async function loadLinks() {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/parent/tokens"), { headers: { ...getAuthHeaders() } });
      const data = await parseJsonResponse<{ tokens: LinkToken[] }>(res);
      if (res.ok) setLinks(data.tokens || []);
    } catch {
      // table just stays empty; not fatal
    } finally {
      setLoading(false);
    }
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/parent/tokens"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ label: label.trim() || null }),
      });
      const data = await parseJsonResponse<{ detail?: string }>(res);
      if (!res.ok) { setError(getApiErrorMessage(data, "Could not create link.")); return; }
      setLabel("");
      await loadLinks();
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(id: string) {
    try {
      await fetch(getApiUrl(`/api/parent/tokens/${id}`), { method: "DELETE", headers: { ...getAuthHeaders() } });
      setLinks(prev => prev.filter(l => l.id !== id));
    } catch {
      // ignore — link stays in list, user can retry
    }
  }

  function copyLink(link: LinkToken) {
    const url = `${origin}/parent/${link.token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 40 }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#0f172a", marginBottom: 8 }}>Parent Access</h1>
        <p style={{ color: "#64748b", fontSize: 15, maxWidth: 560 }}>
          Create a link to share with a parent or guardian. Anyone with the link can see a read-only summary of your progress — no account needed on their end. Revoke a link any time to stop sharing.
        </p>
      </header>

      <form onSubmit={createLink} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 24, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Label (optional)</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Mom's link"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
        </div>
        <button type="submit" disabled={creating} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {creating ? "Creating…" : "+ Create Link"}
        </button>
      </form>

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading links…</p>
      ) : links.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>No parent links yet. Create one above.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 }}>
          {links.map(link => (
            <div key={link.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{link.label || "Parent link"}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Created {new Date(link.createdAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copyLink(link)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {copiedId === link.id ? "Copied!" : "Copy link"}
                </button>
                <button onClick={() => revokeLink(link.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
