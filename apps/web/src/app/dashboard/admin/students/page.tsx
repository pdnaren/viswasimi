"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { Loader2 } from "lucide-react";

type UserRow = { id: string; name: string; email: string; grade: string; role: string; createdAt: string | null; planName: string | null };
type UsageSummary = {
  totalUsers: number;
  newSignups7d: number;
  usersByGrade: { grade: string; count: number }[];
  activeSubscriptionsByPlan: { planName: string; count: number }[];
  totalChatMessages: number;
  totalAssessmentsCompleted: number;
  averageAssessmentScore: number | null;
  mistakesByCategory: { category: string; count: number }[];
};

function formatCategory(category: string): string {
  return category.toLowerCase().split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function PlanEditor({ userId, currentPlan, onApplied }: { userId: string; currentPlan: string | null; onApplied: () => void }) {
  const [planName, setPlanName] = useState(currentPlan || "free");
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/subscription`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ planName, days: days ? Number(days) : null }),
      });
      const data = await parseJsonResponse<{ detail?: string }>(res);
      if (!res.ok) { setError(getApiErrorMessage(data, "Could not update plan.")); return; }
      onApplied();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select value={planName} onChange={e => setPlanName(e.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 }}>
        <option value="free">free</option>
        <option value="basic">basic</option>
      </select>
      <input
        type="number" placeholder="days (optional)" value={days} onChange={e => setDays(e.target.value)}
        style={{ width: 110, padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12 }}
      />
      <button onClick={apply} disabled={saving} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#4f6ef7", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        {saving ? "…" : "Apply"}
      </button>
      {error && <span style={{ color: "#dc2626", fontSize: 11 }}>{error}</span>}
    </div>
  );
}

export default function AdminStudentsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/profile/me"), { headers: { ...getAuthHeaders() } });
        if (cancelled) return;
        if (!res.ok) { router.replace("/login"); return; }
        const payload = await parseJsonResponse<{ role?: string; user?: { role?: string } }>(res);
        const role = payload.role || payload.user?.role;
        if (role && role.toUpperCase() === "ADMIN") {
          setIsAuthorized(true);
        } else {
          router.replace("/dashboard/chat");
        }
      } catch {
        if (!cancelled) router.replace("/dashboard/chat");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/usage/summary"), { headers: { ...getAuthHeaders() } });
      const data = await parseJsonResponse<UsageSummary>(res);
      if (res.ok) setUsage(data);
    } catch {
      // non-critical panel; ignore
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(getApiUrl(`/api/admin/users?${params}`), { headers: { ...getAuthHeaders() } });
      const data = await parseJsonResponse<{ users: UserRow[]; total: number }>(res);
      if (res.ok) {
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch {
      // table just stays empty; not fatal
    } finally {
      setLoadingUsers(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (!isAuthorized) return;
    void (async () => { await loadUsage(); })();
  }, [isAuthorized, loadUsage]);

  useEffect(() => {
    if (!isAuthorized) return;
    void (async () => { await loadUsers(); })();
  }, [isAuthorized, loadUsers]);

  if (checking || !isAuthorized) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <Loader2 size={32} color="#4f6ef7" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Students &amp; Usage</h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>Manage students, subscriptions, and monitor platform usage.</p>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Link href="/dashboard/admin" style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textDecoration: "none", padding: "6px 12px", borderRadius: 8 }}>
            Content
          </Link>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4f6ef7", textDecoration: "none", padding: "6px 12px", borderRadius: 8, background: "#eef2ff" }}>
            Students &amp; Usage
          </span>
        </div>
      </header>

      {usage && (
        <section style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <StatCard label="Total Students" value={usage.totalUsers} />
            <StatCard label="New (7 days)" value={usage.newSignups7d} />
            <StatCard label="Chat Messages" value={usage.totalChatMessages} />
            <StatCard label="Assessments Completed" value={usage.totalAssessmentsCompleted} />
            <StatCard label="Avg Assessment Score" value={usage.averageAssessmentScore !== null ? `${usage.averageAssessmentScore}%` : "—"} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, flex: "1 1 220px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Active plans</div>
              {usage.activeSubscriptionsByPlan.map(p => (
                <div key={p.planName} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  <span>{p.planName}</span><span style={{ fontWeight: 700 }}>{p.count}</span>
                </div>
              ))}
            </div>
            {usage.mistakesByCategory.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, flex: "1 1 260px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Common mistakes (all students)</div>
                {usage.mistakesByCategory.map(m => (
                  <div key={m.category} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 4 }}>
                    <span>{formatCategory(m.category)}</span><span style={{ fontWeight: 700 }}>{m.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Students ({total})</h2>
          <input
            placeholder="Search name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, width: 240 }}
          />
        </div>

        {loadingUsers ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Loading students…</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 14 }}>No students found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 6px" }}>Name</th>
                  <th style={{ padding: "8px 6px" }}>Email</th>
                  <th style={{ padding: "8px 6px" }}>Grade</th>
                  <th style={{ padding: "8px 6px" }}>Role</th>
                  <th style={{ padding: "8px 6px" }}>Joined</th>
                  <th style={{ padding: "8px 6px" }}>Plan</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 6px", fontWeight: 600, color: "#1e293b" }}>{u.name}</td>
                    <td style={{ padding: "10px 6px", color: "#475569" }}>{u.email}</td>
                    <td style={{ padding: "10px 6px", color: "#475569" }}>{u.grade}</td>
                    <td style={{ padding: "10px 6px", color: "#475569" }}>{u.role}</td>
                    <td style={{ padding: "10px 6px", color: "#94a3b8" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <PlanEditor userId={u.id} currentPlan={u.planName} onApplied={loadUsers} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: page <= 1 ? "not-allowed" : "pointer" }}>
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: page >= totalPages ? "not-allowed" : "pointer" }}>
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
