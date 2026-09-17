"use client";

import React, { use, useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { parseJsonResponse, getApiErrorMessage } from "@/app/lib/auth-client";

type ParentView = {
  studentName: string;
  grade: string;
  studyTimeMinutes7d: number;
  streak: number;
  topicsCompleted: number;
  topicsTotal: number;
  subjectMastery: { name: string; mastery: number; topicsCompleted: number; topicsTotal: number }[];
  weakAreas: string[];
  recentAssessments: { label: string; score: number | null; completedAt: string | null }[];
  upcomingLessons: { topicName: string; subjectName: string; startsAt: string }[];
};

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

export default function ParentViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ParentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/parent/view/${token}`));
        const payload = await parseJsonResponse<ParentView & { detail?: string }>(res);
        if (cancelled) return;
        if (!res.ok) { setError(getApiErrorMessage(payload, "This link is invalid or has been revoked.")); return; }
        setData(payload);
      } catch {
        if (!cancelled) setError("Could not load this page. Please check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", marginBottom: 6 }}>VISWASIMI · PARENT VIEW</div>
          {data && (
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#0f172a" }}>
              {data.studentName}&apos;s Progress
            </h1>
          )}
          {data && <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>{data.grade}</p>}
        </header>

        {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}

        {error && !loading && (
          <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 16, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label="Study Time (7 days)" value={`${data.studyTimeMinutes7d} min`} />
              <StatCard label="Day Streak" value={data.streak} />
              <StatCard label="Topics Completed" value={`${data.topicsCompleted} / ${data.topicsTotal}`} />
            </div>

            <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Subject Mastery</h2>
              {data.subjectMastery.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>No curriculum activity yet.</p>
              ) : (
                data.subjectMastery.map(s => (
                  <div key={s.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{s.name}</span>
                      <span style={{ color: "#64748b" }}>{s.mastery}% · {s.topicsCompleted}/{s.topicsTotal} topics</span>
                    </div>
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${s.mastery}%`, background: s.mastery >= 50 ? "#6366f1" : "#f59e0b", borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              )}
              {data.weakAreas.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
                  <strong>Needs attention:</strong> {data.weakAreas.join(", ")}
                </div>
              )}
            </section>

            <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Recent Test Scores</h2>
              {data.recentAssessments.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>No quizzes completed yet.</p>
              ) : (
                data.recentAssessments.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.recentAssessments.length - 1 ? "1px solid #f1f5f9" : "none", fontSize: 13 }}>
                    <span style={{ color: "#1e293b" }}>{a.label}</span>
                    <span style={{ fontWeight: 700, color: (a.score ?? 0) >= 80 ? "#059669" : (a.score ?? 0) >= 50 ? "#d97706" : "#dc2626" }}>
                      {a.score !== null ? `${a.score}%` : "—"}
                    </span>
                  </div>
                ))
              )}
            </section>

            <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Upcoming Lessons</h2>
              {data.upcomingLessons.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>Nothing scheduled right now.</p>
              ) : (
                data.upcomingLessons.map((l, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < data.upcomingLessons.length - 1 ? "1px solid #f1f5f9" : "none", fontSize: 13 }}>
                    <span style={{ color: "#1e293b" }}>{l.topicName} <span style={{ color: "#94a3b8" }}>· {l.subjectName}</span></span>
                    <span style={{ color: "#64748b" }}>{new Date(l.startsAt).toLocaleString()}</span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
