"use client";

import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyRow = {
  date: string; minutes: number;
  topicsCompleted: number; streak: number;
};
type SubjectMastery = {
  name: string; mastery: number;
  topicsDone: number; topicsTotal: number;
};
type RecentEvent = {
  id: string; type: string; topic: string;
  subject: string; score: number | null; ts: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const EVENT_META: Record<string, { icon: string; color: string; label: string }> = {
  STARTED:      { icon: "▶",  color: "#6366f1", label: "Started"   },
  CHECKPOINT:   { icon: "💬", color: "#3b82f6", label: "Checkpoint"},
  COMPLETED:    { icon: "✅", color: "#10b981", label: "Completed" },
  REVISED:      { icon: "🔄", color: "#f59e0b", label: "Revised"   },
  QUIZ_PASSED:  { icon: "🏆", color: "#10b981", label: "Quiz Pass" },
  QUIZ_FAILED:  { icon: "❌", color: "#ef4444", label: "Quiz Fail" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function barHeight(val: number, max: number) {
  if (!max) return 4;
  return Math.max(4, Math.round((val / max) * 100));
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ data, valueKey, color, label }: {
  data: DailyRow[]; valueKey: "minutes" | "topicsCompleted";
  color: string; label: string;
}) {
  // FIX: Force conversion to Number to prevent string concatenation math errors
  const values = data.map(d => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  
  return (
    <div className="pr-chart-wrap">
      <div className="pr-chart-label">{label}</div>
      <div className="pr-bars">
        {data.map((d, i) => {
          const numericValue = Number(d[valueKey]) || 0;
          return (
            <div key={i} className="pr-bar-col">
              <div className="pr-bar-bg">
                <div
                  className="pr-bar-fill"
                  style={{ height: `${barHeight(numericValue, max)}%`, background: color }}
                  title={`${numericValue} ${valueKey === "minutes" ? "min" : "topics"}`}
                />
              </div>
              <span className="pr-bar-date">{formatDate(d.date).split(" ")[0]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Subject mastery row ──────────────────────────────────────────────────────
function MasteryRow({ s }: { s: SubjectMastery }) {
  // Force numeric conversions just in case the DB returned strings
  const mastery = Number(s.mastery) || 0;
  const done = Number(s.topicsDone) || 0;
  const total = Number(s.topicsTotal) || 0;

  return (
    <div className="pr-mastery-row">
      <div className="pr-mastery-left">
        <span className="pr-mastery-name">{s.name}</span>
        <span className="pr-mastery-count">{done}/{total} topics</span>
      </div>
      <div className="pr-mastery-right">
        <div className="pr-mastery-bar-bg">
          <div
            className="pr-mastery-bar-fill"
            style={{
              width: `${mastery}%`,
              background: mastery >= 70 ? "#10b981" : mastery >= 40 ? "#3b82f6" : "#f59e0b",
            }}
          />
        </div>
        <span className="pr-mastery-pct">{mastery}%</span>
      </div>
    </div>
  );
}

// ─── Recent event row ─────────────────────────────────────────────────────────
function EventRow({ ev }: { ev: RecentEvent }) {
  const meta = EVENT_META[ev.type] ?? { icon: "•", color: "var(--muted)", label: ev.type };
  return (
    <div className="pr-event-row">
      <div className="pr-event-icon" style={{ background: `${meta.color}18`, color: meta.color }}>
        {meta.icon}
      </div>
      <div className="pr-event-info">
        <div className="pr-event-topic">{ev.topic}</div>
        <div className="pr-event-meta">{ev.subject} · {formatTs(ev.ts)}</div>
      </div>
      <div className="pr-event-right">
        <span className="pr-event-badge" style={{ background: `${meta.color}15`, color: meta.color }}>
          {meta.label}
        </span>
        {ev.score !== null && (
          <span className="pr-event-score">{Math.round(Number(ev.score))}%</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const [daily, setDaily]           = useState<DailyRow[]>([]);
  const [subjectMastery, setSM]     = useState<SubjectMastery[]>([]);
  const [recent, setRecent]         = useState<RecentEvent[]>([]);
  const [range, setRange]           = useState<"week" | "month">("week");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(getApiUrl(`/api/progress/overview?range=${range}`), {
          headers: { ...getAuthHeaders() },
        });
        const data = await parseJsonResponse<{
          daily: DailyRow[]; subjectMastery: SubjectMastery[]; recent: RecentEvent[];
        }>(res);
        if (!res.ok) throw new Error("Failed to load progress");
        setDaily(data.daily || []);
        setSM(data.subjectMastery || []);
        setRecent(data.recent || []);
      } catch {
        setError("Failed to load progress data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  // FIX: Force numeric conversion during reduction
  const totalMinutes  = daily.reduce((s, d) => s + (Number(d.minutes) || 0), 0);
  const totalTopics   = daily.reduce((s, d) => s + (Number(d.topicsCompleted) || 0), 0);
  const maxStreak     = daily.reduce((s, d) => Math.max(s, (Number(d.streak) || 0)), 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');

        .pr-page {
          font-family: 'Outfit', sans-serif;
          color: var(--text);
          min-height: 100%;
          padding: 32px 36px 56px;
          background: var(--bg);
          max-width: 1100px;
        }

        /* ── Top ── */
        .pr-topbar {
          display: flex; align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 28px;
          animation: fadeUp 0.4s ease both;
          flex-wrap: wrap; gap: 16px;
        }
        .pr-page-title {
          font-family: 'DM Serif Display', serif;
          font-size: 30px; margin: 0 0 4px; color: var(--text);
        }
        .pr-page-sub { font-size: 14px; color: var(--muted); margin: 0; }

        /* Range toggle */
        .pr-range-toggle {
          display: flex; gap: 4px;
          background: var(--card); padding: 4px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .pr-range-btn {
          padding: 7px 18px; border-radius: 7px;
          border: none; font-size: 13px; font-weight: 600;
          font-family: 'Outfit', sans-serif;
          cursor: pointer; transition: background 0.18s, color 0.18s;
          color: var(--muted); background: transparent;
        }
        .pr-range-btn.active { background: #6366f1; color: #fff; }

        /* ── Summary cards ── */
        .pr-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px; margin-bottom: 28px;
          animation: fadeUp 0.45s ease both 60ms;
        }
        @media (max-width: 700px) { .pr-summary { grid-template-columns: 1fr; } }
        .pr-sum-card {
          background: var(--card); border-radius: 14px;
          padding: 20px 18px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          border-top: 3px solid var(--ac);
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .pr-sum-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
        .pr-sum-icon {
          font-size: 22px; margin-bottom: 10px;
        }
        .pr-sum-value {
          font-size: 28px; font-weight: 800; color: var(--text); margin-bottom: 3px;
        }
        .pr-sum-label { font-size: 12.5px; color: var(--muted); font-weight: 500; }

        /* ── Two column layout ── */
        .pr-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px; margin-bottom: 24px;
          animation: fadeUp 0.45s ease both 120ms;
        }
        @media (max-width: 760px) { .pr-cols { grid-template-columns: 1fr; } }

        /* Card */
        .pr-card {
          background: var(--card); border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .pr-card-head {
          padding: 16px 20px 14px;
          border-bottom: 1px solid var(--card-hover);
        }
        .pr-card-title { font-size: 15px; font-weight: 700; color: var(--text); margin: 0; }
        .pr-card-body  { padding: 18px 20px; }

        /* Bar chart */
        .pr-chart-wrap {}
        .pr-chart-label { font-size: 12px; color: var(--muted); margin-bottom: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .pr-bars {
          display: flex; align-items: flex-end;
          gap: 6px; height: 120px;
        }
        .pr-bar-col {
          flex: 1; display: flex;
          flex-direction: column; align-items: center;
          gap: 4px; height: 100%;
        }
        .pr-bar-bg {
          flex: 1; width: 100%;
          background: var(--card-hover); border-radius: 4px;
          display: flex; flex-direction: column-reverse;
          overflow: hidden;
        }
        .pr-bar-fill { width: 100%; border-radius: 4px; transition: height 0.7s cubic-bezier(.4,0,.2,1); }
        .pr-bar-date { font-size: 9.5px; color: var(--muted); font-weight: 600; }

        /* Mastery rows */
        .pr-mastery-list { display: flex; flex-direction: column; gap: 14px; }
        .pr-mastery-row { display: flex; align-items: center; gap: 14px; }
        .pr-mastery-left { min-width: 0; flex: 1; }
        .pr-mastery-name { font-size: 13.5px; font-weight: 700; color: var(--text); display: block; }
        .pr-mastery-count { font-size: 11.5px; color: var(--muted); }
        .pr-mastery-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .pr-mastery-bar-bg { width: 110px; height: 6px; border-radius: 3px; background: var(--card-hover); }
        .pr-mastery-bar-fill { height: 100%; border-radius: 3px; transition: width 0.7s ease; }
        .pr-mastery-pct { font-size: 12px; font-weight: 700; color: var(--text); min-width: 34px; text-align: right; }

        /* Recent events */
        .pr-events-card {
          background: var(--card); border-radius: 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          overflow: hidden;
          animation: fadeUp 0.45s ease both 180ms;
        }
        .pr-event-row {
          display: flex; align-items: center;
          padding: 12px 20px; gap: 14px;
          border-bottom: 1px solid var(--bg);
          transition: background 0.15s;
        }
        .pr-event-row:last-child { border-bottom: none; }
        .pr-event-row:hover { background: var(--card-hover); }
        .pr-event-icon {
          width: 34px; height: 34px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0;
        }
        .pr-event-info { flex: 1; min-width: 0; }
        .pr-event-topic { font-size: 13.5px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pr-event-meta  { font-size: 12px; color: var(--muted); margin-top: 1px; }
        .pr-event-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .pr-event-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; }
        .pr-event-score { font-size: 13px; font-weight: 800; color: #10b981; }

        /* Skeleton / error / empty */
        .pr-skeleton {
          background: linear-gradient(90deg,var(--card-hover) 25%,var(--border) 50%,var(--card-hover) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 12px;
        }
        .pr-error { padding: 14px 18px; border-radius: 12px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 14px; margin-bottom: 24px; }
        .pr-empty { text-align: center; padding: 40px 24px; color: var(--muted); font-size: 14px; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position:200% 0; }
          100% { background-position:-200% 0; }
        }
      `}</style>

      <div className="pr-page">
        {/* Top bar */}
        <div className="pr-topbar">
          <div>
            <h1 className="pr-page-title">My Progress</h1>
            <p className="pr-page-sub">Track your learning activity and mastery</p>
          </div>
          <div className="pr-range-toggle">
            <button className={`pr-range-btn ${range === "week" ? "active" : ""}`}
              onClick={() => setRange("week")}>This Week</button>
            <button className={`pr-range-btn ${range === "month" ? "active" : ""}`}
              onClick={() => setRange("month")}>This Month</button>
          </div>
        </div>

        {error && <div className="pr-error">⚠️ {error}</div>}

        {/* Summary */}
        <div className="pr-summary">
          {loading ? (
            [0,1,2].map(i => <div key={i} className="pr-skeleton" style={{ height: 100 }} />)
          ) : (
            <>
              <div className="pr-sum-card" style={{ "--ac": "#6366f1" } as React.CSSProperties}>
                <div className="pr-sum-icon">⏰</div>
                <div className="pr-sum-value">{totalMinutes}</div>
                <div className="pr-sum-label">Minutes Studied</div>
              </div>
              <div className="pr-sum-card" style={{ "--ac": "#10b981" } as React.CSSProperties}>
                <div className="pr-sum-icon">📚</div>
                <div className="pr-sum-value">{totalTopics}</div>
                <div className="pr-sum-label">Topics Studied</div>
              </div>
              <div className="pr-sum-card" style={{ "--ac": "#f59e0b" } as React.CSSProperties}>
                <div className="pr-sum-icon">🔥</div>
                <div className="pr-sum-value">{maxStreak}</div>
                <div className="pr-sum-label">Best Streak</div>
              </div>
            </>
          )}
        </div>

        {/* Charts + Mastery */}
        <div className="pr-cols">
          {/* Activity chart */}
          <div className="pr-card">
            <div className="pr-card-head"><h3 className="pr-card-title">Study Activity</h3></div>
            <div className="pr-card-body">
              {loading ? (
                <div className="pr-skeleton" style={{ height: 140 }} />
              ) : daily.length === 0 ? (
                <div className="pr-empty">No activity data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <BarChart data={daily} valueKey="minutes"         color="#6366f1" label="Minutes per day" />
                  <BarChart data={daily} valueKey="topicsCompleted" color="#10b981" label="Topics per day" />
                </div>
              )}
            </div>
          </div>

          {/* Subject mastery */}
          <div className="pr-card">
            <div className="pr-card-head"><h3 className="pr-card-title">Subject Mastery</h3></div>
            <div className="pr-card-body">
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[0,1,2,3].map(i => <div key={i} className="pr-skeleton" style={{ height: 36 }} />)}
                </div>
              ) : subjectMastery.length === 0 ? (
                <div className="pr-empty">No mastery data yet.</div>
              ) : (
                <div className="pr-mastery-list">
                  {subjectMastery.map(s => <MasteryRow key={s.name} s={s} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent events */}
        <div className="pr-events-card">
          <div className="pr-card-head" style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--card-hover)" }}>
            <h3 className="pr-card-title">Recent Activity</h3>
          </div>
          {loading ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {[0,1,2,3].map(i => <div key={i} className="pr-skeleton" style={{ height: 52 }} />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="pr-empty">No recent activity. Start learning!</div>
          ) : (
            recent.map(ev => <EventRow key={ev.id} ev={ev} />)
          )}
        </div>
      </div>
    </>
  );
}