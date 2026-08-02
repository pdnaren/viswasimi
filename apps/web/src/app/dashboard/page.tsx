"use client";

import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

// ─── Types ───────────────────────────────────────────────────────────────────
type Stats = {
  aiQuestionsAsked: number;
  topicsCompleted: number;
  accuracyScore: number;
  dailyStreak: number;
};
type Topic = {
  id: string;
  name: string;
  subjectName: string;
  chapterName: string;
  mastery: number;
  state: string;
  durationM: number;
};
type UserInfo = {
  name: string;
  grade: number;
  email: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function masteryLabel(m: number) {
  if (m >= 5) return "Mastered";
  if (m >= 3) return "Proficient";
  if (m >= 1) return "Learning";
  return "New";
}
function masteryColor(m: number) {
  if (m >= 5) return "#10b981";
  if (m >= 3) return "#3b82f6";
  if (m >= 1) return "#f59e0b";
  return "#94a3b8";
}
function stateColor(s: string) {
  if (s === "done") return "#10b981";
  if (s === "in_progress") return "#3b82f6";
  if (s === "available") return "#6366f1";
  return "#94a3b8";
}
function stateLabel(s: string) {
  if (s === "done") return "Done";
  if (s === "in_progress") return "In Progress";
  if (s === "available") return "Available";
  return "Locked";
}
function greetingByTime() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, delay }: {
  icon: string; label: string; value: number | string; accent: string; delay: number;
}) {
  return (
    <div className="stat-card" style={{ animationDelay: `${delay}ms`, borderTop: `3px solid ${accent}` }}>
      <div className="stat-icon" style={{ background: `${accent}18`, color: accent }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ─── Topic Card ──────────────────────────────────────────────────────────────
function TopicCard({ topic, delay }: { topic: Topic; delay: number }) {
  const pct = Math.round((topic.mastery / 5) * 100);
  return (
    <div 
      className="topic-card"
      onClick={() => window.location.href = `/learn/${topic.id}`}
      style={{ animationDelay: `${delay}ms` }}
      >
      <div className="topic-card-top">
        <span className="topic-badge" style={{ background: `${stateColor(topic.state)}18`, color: stateColor(topic.state) }}>
          {stateLabel(topic.state)}
        </span>
        <span className="topic-duration">⏱ {topic.durationM}m</span>
      </div>
      <div className="topic-name">{topic.name}</div>
      <div className="topic-meta">{topic.subjectName} · {topic.chapterName}</div>
      <div className="mastery-bar-wrap">
        <div className="mastery-bar-bg">
          <div className="mastery-bar-fill" style={{ width: `${pct}%`, background: masteryColor(topic.mastery) }} />
        </div>
        <span className="mastery-label" style={{ color: masteryColor(topic.mastery) }}>
          {masteryLabel(topic.mastery)}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recommended, setRecommended] = useState<Topic[]>([]);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/dashboard/overview"), {
          headers: { ...getAuthHeaders() },
        });
        const data = await parseJsonResponse<{
          stats: Stats;
          recommendedTopics: Topic[];
          user: UserInfo;
        }>(res);
        if (!res.ok) throw new Error("Failed to load dashboard");
        setStats(data.stats);
        setRecommended(data.recommendedTopics || []);
        setUser(data.user);
      } catch {
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');

        .db-page {
          font-family: 'Outfit', sans-serif;
          color: #1a1f2e;
          min-height: 100%;
          padding: 32px 36px 48px;
          background: #f5f7ff;
          max-width: 1200px;
        }

        /* ── Hero ── */
        .db-hero {
          margin-bottom: 36px;
          animation: fadeUp 0.5s ease both;
        }
        .db-greeting {
          font-size: 13px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1px;
          color: #6366f1; margin-bottom: 6px;
        }
        .db-name {
          font-family: 'DM Serif Display', serif;
          font-size: 34px; color: #1a1f2e;
          margin: 0 0 6px; line-height: 1.1;
        }
        .db-sub {
          font-size: 14.5px; color: #64748b; margin: 0;
        }

        /* ── Stats ── */
        .db-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 40px;
        }
        @media (max-width: 900px) { .db-stats-grid { grid-template-columns: repeat(2,1fr); } }

        .stat-card {
          background: #fff;
          border-radius: 16px;
          padding: 22px 20px 18px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          animation: fadeUp 0.5s ease both;
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.09);
        }
        .stat-icon {
          width: 40px; height: 40px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 14px;
        }
        .stat-value {
          font-size: 32px; font-weight: 800; line-height: 1;
          color: #1a1f2e; margin-bottom: 5px;
        }
        .stat-label {
          font-size: 12.5px; color: #94a3b8; font-weight: 500;
        }

        /* ── Section heading ── */
        .db-section-head {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .db-section-title {
          font-size: 18px; font-weight: 700; color: #1a1f2e; margin: 0;
        }
        .db-section-link {
          font-size: 13px; font-weight: 600; color: #6366f1;
          text-decoration: none; opacity: 0.8;
          transition: opacity 0.15s;
        }
        .db-section-link:hover { opacity: 1; }

        /* ── Topic cards ── */
        .topics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 860px) { .topics-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 560px) { .topics-grid { grid-template-columns: 1fr; } }

        .topic-card {
          background: #fff;
          border-radius: 14px;
          padding: 18px 18px 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          animation: fadeUp 0.5s ease both;
          transition: transform 0.18s, box-shadow 0.18s;
          cursor: default;
        }
        .topic-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.09);
        }
        .topic-card-top {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 10px;
        }
        .topic-badge {
          font-size: 11px; font-weight: 700;
          padding: 3px 9px; border-radius: 20px;
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .topic-duration { font-size: 12px; color: #94a3b8; }
        .topic-name {
          font-size: 14.5px; font-weight: 700;
          color: #1a1f2e; margin-bottom: 4px; line-height: 1.3;
        }
        .topic-meta {
          font-size: 12px; color: #94a3b8; margin-bottom: 14px;
        }
        .mastery-bar-wrap {
          display: flex; align-items: center; gap: 10px;
        }
        .mastery-bar-bg {
          flex: 1; height: 5px; border-radius: 3px; background: #f1f5f9;
        }
        .mastery-bar-fill {
          height: 100%; border-radius: 3px;
          transition: width 0.8s cubic-bezier(.4,0,.2,1);
        }
        .mastery-label { font-size: 11px; font-weight: 600; white-space: nowrap; }

        /* ── Empty / Error / Loading ── */
        .db-empty {
          text-align: center; padding: 48px 24px;
          color: #94a3b8; font-size: 14px;
        }
        .db-error {
          padding: 16px 20px; border-radius: 12px;
          background: #fef2f2; border: 1px solid #fecaca;
          color: #dc2626; font-size: 14px; margin-bottom: 24px;
        }
        .db-skeleton {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 12px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="db-page">
        {error && <div className="db-error">⚠️ {error}</div>}

        {/* Hero */}
        <div className="db-hero">
          <p className="db-greeting">{greetingByTime()}</p>
          <h1 className="db-name">
            {loading ? "Loading…" : `${user?.name ?? "Student"} 👋`}
          </h1>
          <p className="db-sub">
            {loading ? "" : `Grade ${user?.grade ?? "—"} · Here's your learning snapshot for today`}
          </p>
        </div>

        {/* Stats */}
        <div className="db-stats-grid">
          {loading ? (
            [0,1,2,3].map(i => (
              <div key={i} className="stat-card db-skeleton" style={{ height: 130, animationDelay: `${i*80}ms` }} />
            ))
          ) : (
            <>
              <StatCard icon="🔥" label="Day Streak"       value={stats?.dailyStreak ?? 0}      accent="#f59e0b" delay={0}   />
              <StatCard icon="✅" label="Topics Completed" value={stats?.topicsCompleted ?? 0}   accent="#10b981" delay={80}  />
              <StatCard icon="🎯" label="Accuracy Score"   value={`${stats?.accuracyScore ?? 0}%`} accent="#6366f1" delay={160} />
              <StatCard icon="💬" label="AI Questions"     value={stats?.aiQuestionsAsked ?? 0}  accent="#3b82f6" delay={240} />
            </>
          )}
        </div>

        {/* Recommended Topics */}
        <div className="db-section-head">
          <h2 className="db-section-title">Recommended for You</h2>
          <a href="dashboard/curriculum" className="db-section-link">View All →</a>
        </div>

        {loading ? (
          <div className="topics-grid">
            {[0,1,2].map(i => (
              <div key={i} className="db-skeleton" style={{ height: 140, borderRadius: 14, animationDelay: `${i*80}ms` }} />
            ))}
          </div>
        ) : recommended.length === 0 ? (
          <div className="db-empty">
            🎉 No pending topics — you're all caught up!
          </div>
        ) : (
          <div className="topics-grid">
            {recommended.map((t, i) => (
              <TopicCard key={t.id} topic={t} delay={i * 60} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
