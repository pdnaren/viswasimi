"use client";

import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Target, PlayCircle, CheckCircle2, AlertCircle, X, BookOpen } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type PlanItem = {
  id: string;
  topicId: string;
  topicName: string;
  chapterName: string;
  subjectName: string;
  startsAt: string;
  endsAt: string;
  state: "SCHEDULED" | "IN_PROGRESS" | "DONE" | "MISSED" | "RESCHEDULED";
  targetMastery: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDurationMinutes(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

const STATE_CONFIG = {
  SCHEDULED:   { class: "st-sched", label: "Scheduled", dot: "#3b82f6" },
  IN_PROGRESS: { class: "st-prog", label: "In Progress", dot: "#6366f1" },
  DONE:        { class: "st-done", label: "Completed", dot: "#10b981" },
  MISSED:      { class: "st-miss", label: "Missed", dot: "#ef4444" },
  RESCHEDULED: { class: "st-sched", label: "Rescheduled", dot: "#f59e0b" },
};

export default function StudyPlanPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchTodayPlan();
  }, []);

  // Add 'silent = false' to prevent the spinner from wiping the screen on background updates
  const fetchTodayPlan = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(getApiUrl("/api/study-plan/today"), {
        headers: { ...getAuthHeaders() },
      });
      const data = await parseJsonResponse<{ items: PlanItem[] }>(res);
      if (!res.ok) throw new Error("Failed to load today's study plan.");
      setItems(data.items || []);
    } catch (err) {
      setError("Could not load your schedule. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateItemState = async (itemId: string, newState: string, topicId?: string, durationM?: number) => {
    try {
      // 1. OPTIMISTIC UPDATE: Instantly change the UI without waiting for the database
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === itemId ? { ...item, state: newState as PlanItem["state"] } : item
        )
      );

      // 2. Do the database calls in the background
      await fetch(getApiUrl(`/api/study-plan/item/${itemId}/state`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ state: newState }),
      });

      if (newState === "DONE" && topicId) {
        await Promise.all([
          fetch(getApiUrl("/api/progress/log"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ topicId, event: "COMPLETED", score: 0, seconds: 0 }),
          }),
          fetch(getApiUrl("/api/mastery/update"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ topicId, increment: 5 }), 
          }),
          fetch(getApiUrl("/api/progress/daily-update"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ topicsCompleted: 1, minutes: durationM || 30 }),
          })
        ]);
      }

      // 3. SILENT REFRESH: Sync with the database, but don't show the loading spinner
      fetchTodayPlan(true); 
    } catch (err) {
      console.error("Failed to update status", err);
      fetchTodayPlan(true); // Revert the UI if the backend request actually failed
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      // Optimistically remove it from the screen immediately
      setItems(prevItems => prevItems.filter(item => item.id !== itemId));
      
      await fetch(getApiUrl(`/api/study-plan/item/${itemId}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      
      // Silent refresh
      fetchTodayPlan(true); 
    } catch (err) {
      console.error("Failed to remove item", err);
      fetchTodayPlan(true);
    }
  };

  // Calculate quick stats for the header
  const completedCount = items.filter(item => item.state === "DONE").length;
  const totalCount = items.length;

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="sp-spinner"></div>
        <style>{`.sp-spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: #4f7cff; border-radius: 50%; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap');

        .sp-page {
          font-family: 'Outfit', sans-serif;
          padding: 40px;
          color: var(--text);
          max-width: 900px;
          margin: 0 auto;
        }

        /* ── Header ── */
        .sp-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 48px; 
          flex-wrap: wrap; 
          gap: 24px; 
          animation: fadeUp 0.4s ease both; 
          background: var(--card);
          padding: 24px 32px;
          border-radius: 20px;
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .sp-title-wrap { display: flex; flex-direction: column; gap: 8px; }
        .sp-subtitle { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #4f7cff; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .sp-title { font-family: 'DM Serif Display', serif; font-size: 36px; margin: 0; line-height: 1.1; color: var(--text); }
        .sp-desc { color: var(--muted); font-size: 16px; margin: 0; font-weight: 500; }
        .sp-progress-text { color: #10b981; font-weight: 700; }

        .sp-error { display: flex; align-items: center; gap: 12px; background: #fef2f2; color: #ef4444; padding: 16px; border-radius: 12px; border: 1px solid #fecaca; margin-bottom: 32px; font-weight: 500; }
        
        /* ── Buttons ── */
        .sp-btn-primary { 
          background: #4f7cff; color: #fff; border: none; padding: 14px 28px; border-radius: 14px; 
          font-weight: 600; font-size: 16px; cursor: pointer; display: flex; align-items: center; 
          gap: 10px; transition: 0.2s; font-family: 'Outfit', sans-serif; box-shadow: 0 4px 12px rgba(79,124,255,0.25);
        }
        .sp-btn-primary:hover { background: #3b5bdb; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(79,124,255,0.3); }
        
        .sp-btn-secondary { background: var(--card); color: var(--muted); border: 1px solid var(--border-hover); padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: 0.2s; font-family: 'Outfit', sans-serif; }
        .sp-btn-secondary:hover { background: var(--bg); color: #10b981; border-color: #a7f3d0; }

        .sp-btn-remove { background: none; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 6px; border-radius: 8px; transition: 0.2s; }
        .sp-btn-remove:hover { background: #fee2e2; color: #ef4444; }

        /* ── Timeline ── */
        .sp-timeline { position: relative; padding-left: 40px; margin-left: 120px; border-left: 2px solid var(--border); display: flex; flex-direction: column; gap: 32px; }
        .sp-item { position: relative; animation: fadeUp 0.4s ease both; }
        .sp-item:nth-child(2) { animation-delay: 0.1s; }
        .sp-item:nth-child(3) { animation-delay: 0.2s; }

        .sp-dot { position: absolute; left: -51px; top: 24px; width: 20px; height: 20px; border-radius: 50%; border: 4px solid var(--bg); display: flex; align-items: center; justify-content: center; z-index: 2; }
        .sp-dot-inner { width: 8px; height: 8px; border-radius: 50%; }

        /* Time labels */
        .sp-time-label { position: absolute; left: -140px; top: 18px; width: 80px; text-align: right; }
        .sp-time-main { display: block; font-weight: 700; font-size: 15px; color: var(--text); }
        .sp-time-dur { display: block; font-weight: 500; font-size: 13px; color: var(--muted); margin-top: 2px; }

        /* ── Cards ── */
        .sp-card { background: var(--card); border-radius: 20px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid var(--border); transition: transform 0.2s, box-shadow 0.2s; }
        .sp-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.08); border-color: var(--border-hover); }
        
        .sp-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .sp-badges { display: flex; align-items: center; gap: 12px; }
        .sp-badge { font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 99px; border: 1px solid transparent; letter-spacing: 0.3px; text-transform: uppercase;}
        .sp-target { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--muted); background: var(--card-hover); padding: 6px 16px; border-radius: 99px; }
        
        .sp-topic-name { font-size: 26px; font-weight: 800; margin: 0 0 8px; color: var(--text); letter-spacing: -0.5px;}
        .sp-topic-meta { font-size: 16px; color: var(--muted); font-weight: 500; margin: 0 0 28px; }

        /* ── Actions ── */
        .sp-actions { display: flex; gap: 16px; border-top: 1px solid var(--card-hover); padding-top: 24px; flex-wrap: wrap; }
        .sp-done-msg { display: flex; align-items: center; gap: 10px; color: #10b981; background: #ecfdf5; border: 1px solid #d1fae5; padding: 14px 24px; border-radius: 14px; font-weight: 700; font-size: 16px; width: 100%; justify-content: center; }

        /* ── Empty State ── */
        .sp-empty { text-align: center; padding: 80px 20px; background: var(--card); border-radius: 24px; border: 2px dashed var(--border-hover); animation: fadeUp 0.4s ease both; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.02);}
        .sp-empty-icon { width: 80px; height: 80px; background: var(--card-hover); color: #4f7cff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
        .sp-empty h3 { font-size: 24px; color: var(--text); margin: 0 0 12px; font-weight: 800; font-family: 'DM Serif Display', serif;}
        .sp-empty p { color: var(--muted); margin: 0 0 32px; font-size: 16px; max-width: 400px; line-height: 1.5; }

        /* ── Status Colors ── */
        .st-sched { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
        .st-prog { background: #eef2ff; color: #4f46e5; border-color: #c7d2fe; }
        .st-done { background: #ecfdf5; color: #10b981; border-color: #a7f3d0; }
        .st-miss { background: #fef2f2; color: #ef4444; border-color: #fecaca; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

        /* ── Responsive ── */
        .sp-mobile-time { display: none; }
        @media (max-width: 768px) {
          .sp-page { padding: 24px 20px; }
          .sp-header { padding: 20px; flex-direction: column; align-items: flex-start; }
          .sp-timeline { padding-left: 24px; margin-left: 12px; }
          .sp-dot { left: -35px; }
          .sp-time-label { display: none; }
          .sp-mobile-time { display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text); background: var(--card-hover); padding: 6px 14px; border-radius: 8px; font-size: 13px; margin-right: 8px; }
          .sp-btn-primary { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="sp-page">
        {/* User-Friendly Dashboard Header */}
        <header className="sp-header">
          <div className="sp-title-wrap">
            <div className="sp-subtitle">
              <Calendar size={18} /> Today's Schedule
            </div>
            <h1 className="sp-title">Your Study Plan</h1>
            <p className="sp-desc">
              {totalCount > 0 ? (
                <>
                  You have <span className="sp-progress-text">{completedCount} of {totalCount}</span> topics completed today. Keep going!
                </>
              ) : (
                "Your schedule is currently clear."
              )}
            </p>
          </div>
          
          {/* Prominent, single action button */}
          <button 
            onClick={() => router.push("/dashboard/curriculum")} 
            className="sp-btn-primary"
          >
            <BookOpen size={20} /> Add Topic from Curriculum
          </button>
        </header>

        {error && (
          <div className="sp-error">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* Timeline Layout */}
        {totalCount > 0 && (
          <div className="sp-timeline">
            {items.map((item) => {
              const config = STATE_CONFIG[item.state] || STATE_CONFIG.SCHEDULED;
              const duration = getDurationMinutes(item.startsAt, item.endsAt);

              return (
                <div key={item.id} className="sp-item">
                  <div className="sp-dot" style={{ backgroundColor: config.class.includes('st-done') ? '#ecfdf5' : '#eff6ff' }}>
                    <div className="sp-dot-inner" style={{ backgroundColor: config.dot }}></div>
                  </div>

                  <div className="sp-time-label">
                    <span className="sp-time-main">{formatTime(item.startsAt)}</span>
                    <span className="sp-time-dur">{duration} min</span>
                  </div>

                  <div className="sp-card">
                    <div className="sp-card-header">
                      <div className="sp-badges">
                        <div className="sp-mobile-time">
                          <Clock size={14} /> {formatTime(item.startsAt)}
                        </div>
                        <span className={`sp-badge ${config.class}`}>
                          {config.label}
                        </span>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="sp-target">
                          <Target size={14} /> Target Mastery: {item.targetMastery}/5
                        </div>
                        {item.state !== "DONE" && (
                          <button 
                            onClick={() => removeItem(item.id)} 
                            className="sp-btn-remove" 
                            title="Remove from today's plan"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="sp-topic-name">{item.topicName}</h3>
                    <p className="sp-topic-meta">
                      {item.subjectName} • {item.chapterName}
                    </p>

                    <div className="sp-actions">
                      {item.state !== "DONE" ? (
                        <>
                          <button 
                            onClick={() => router.push(`/dashboard/chat?topicId=${item.topicId}`)}
                            className="sp-btn-primary"
                            style={{ padding: "12px 24px", fontSize: "15px", borderRadius: "12px" }}
                          >
                            <PlayCircle size={18} /> Study with AI Tutor
                          </button>
                          
                          <button 
                              onClick={() => updateItemState(item.id, "DONE", item.topicId, duration)}
                              className="sp-btn-secondary"
                              >
                              <CheckCircle2 size={18} /> Mark as Done
                          </button>
                        </>
                      ) : (
                        <div className="sp-done-msg">
                          <CheckCircle2 size={20} /> Excellent work! Topic completed.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Enhanced Empty State */}
        {totalCount === 0 && !loading && !error && (
          <div className="sp-empty">
            <div className="sp-empty-icon">
              <Clock size={40} />
            </div>
            <h3>Ready to learn something new?</h3>
            <p>Your study plan is empty for today. Head over to the Curriculum to browse subjects and add topics to your schedule.</p>
            <button 
              onClick={() => router.push("/dashboard/curriculum")} 
              className="sp-btn-primary"
            >
              <BookOpen size={20} /> Browse Curriculum
            </button>
          </div>
        )}

      </div>
    </>
  );
}