"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type TopicItem = {
  id: string; name: string; order: number; durationM: number; mastery: number; 
  state: string; subjectName: string; chapterName: string;
  startedAt?: string; completedAt?: string; lastStudiedAt?: string;
};

type Chapter = { 
  id: string; name: string; order: number; topics: TopicItem[];
  startedAt?: string; completedAt?: string; lastStudiedAt?: string;
};

type Subject = { 
  id: string; name: string; chapters: Chapter[];
  startedAt?: string; completedAt?: string; lastStudiedAt?: string;
  totalChapters: number; completedChapters: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const STATE_META: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  done:         { label: "Mastered",    color: "#059669", icon: "✨", bg: "rgba(5,150,105,0.15)" },
  in_progress: { label: "Learning",    color: "#2563eb", icon: "📖", bg: "rgba(37,99,235,0.15)" },
  available:   { label: "Next Up",     color: "#6366f1", icon: "🎯", bg: "rgba(99,102,241,0.15)" },
  locked:      { label: "Locked",      color: "#94a3b8", icon: "🔒", bg: "var(--card-hover)" },
};

// ─── Topic Row ────────────────────────────────────────────────────────────────
function TopicRow({ topic }: { topic: TopicItem }) {
  const meta = STATE_META[topic.state] ?? STATE_META.locked;
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToPlan = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdding || added) return;
    try {
      setIsAdding(true);

      // 1. Calculate precise local start and end times in JavaScript
      const start = new Date();
      // Add the topic duration (in minutes) to the start time, defaulting to 45 mins
      const end = new Date(start.getTime() + (topic.durationM || 45) * 60000);

      const res = await fetch(getApiUrl("/api/study-plan/add-item"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ 
          topicId: topic.id, 
          targetMastery: 5,
          startsAt: start.toISOString(), // Sent!
          endsAt: end.toISOString()      // Sent!
        }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        console.error("Backend Error Details:", errData);
        
        let errorMessage = "Unknown error occurred.";
        
        if (Array.isArray(errData.detail)) {
          // Added (e: any) to satisfy TypeScript, and optional chaining (?.) to prevent crashes
          errorMessage = errData.detail.map((e: any) => {
            const field = e?.loc?.length ? e.loc[e.loc.length - 1] : 'Data';
            return `${field}: ${e?.msg || 'Invalid value'}`;
          }).join('\n');
        } else if (errData.detail) {
          errorMessage = typeof errData.detail === 'string' 
            ? errData.detail 
            : JSON.stringify(errData.detail);
        }

        alert(`Could not add topic:\n${errorMessage}`);
        return; 
      }

      setAdded(true);
      setTimeout(() => setAdded(false), 3000);
    } catch (err) { 
      console.error("Network Error:", err); 
      alert("Network error occurred.");
    } finally { 
      setIsAdding(false); 
    }
  };

  return (
    <div className={`cur-topic-card ${topic.state}`}>
      <div className="cur-topic-main">
        <div className="cur-topic-status-icon" style={{ background: meta.bg, color: meta.color }}>
          {meta.icon}
        </div>
        <div className="cur-topic-details">
          <div className="cur-topic-header">
            <span className="cur-topic-name">{topic.name}</span>
            <span className="cur-topic-duration">⏱ {topic.durationM}m</span>
          </div>
          <div className="cur-topic-timeline">
            {topic.startedAt && <div className="cur-time-tag started">Started {formatDate(topic.startedAt)}</div>}
            {topic.completedAt && <div className="cur-time-tag completed">Mastered {formatDate(topic.completedAt)}</div>}
            {topic.lastStudiedAt && !topic.completedAt && (
              <div className="cur-time-tag last">🕒 Last activity {formatDate(topic.lastStudiedAt)}</div>
            )}
          </div>
        </div>
        <div className="cur-topic-actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
           {topic.state !== "locked" && (
            <>
              <Link
                href={`/dashboard/assessments?topicId=${topic.id}&label=${encodeURIComponent(topic.name)}`}
                className="cur-action-btn"
                style={{ textDecoration: "none", display: "inline-block" }}
              >
                📝 Quiz
              </Link>
              <button className={`cur-action-btn ${added ? 'success' : ''} ${topic.state === 'done' ? 'revise' : ''}`}
                onClick={handleAddToPlan} disabled={isAdding || added}>
                {isAdding ? "..." : added ? "Added" : topic.state === 'done' ? "↺ Revise" : "+ Plan"}
              </button>
            </>
           )}
        </div>
      </div>
      <div className="cur-topic-progress">
         <div className="cur-progress-track"><div className="cur-progress-fill" style={{ width: `${(topic.mastery / 5) * 100}%`, background: meta.color }} /></div>
         <span className="cur-mastery-label">{topic.mastery}/5</span>
      </div>
    </div>
  );
}

// ─── Chapter Block ────────────────────────────────────────────────────────────
function ChapterBlock({ chapter }: { chapter: Chapter }) {
  const [open, setOpen] = useState(false);

  const doneCount = chapter.topics.filter(t => t.mastery >= 5).length;
  const totalCount = chapter.topics.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="cur-chapter-container">
      <button className={`cur-chapter-trigger ${open ? 'active' : ''}`} onClick={() => setOpen(!open)}>
        <div className="cur-chapter-info">
          <div className="cur-chapter-title-row">
             <span className="cur-chapter-name">{chapter.name}</span>
             <span className="cur-chapter-badge">{doneCount}/{totalCount} Done</span>
          </div>
          
          {/* THE DATETIME LINE */}
          <div className="cur-group-timeline">
            {chapter.startedAt && (
              <span>🚀 Started {formatDate(chapter.startedAt)}</span>
            )}
            
            {/* If Mastered, show Trophy, otherwise show Last Activity */}
            {chapter.completedAt ? (
              <span style={{color: '#059669', fontWeight: 800}}>🏆 Mastered {formatDate(chapter.completedAt)}</span>
            ) : (
              chapter.lastStudiedAt && <span>🕒 Last active {formatDate(chapter.lastStudiedAt)}</span>
            )}
          </div>

          <div className="cur-chapter-progress-mini">
            <div className="cur-mini-bar"><div className="cur-mini-fill" style={{ width: `${pct}%` }} /></div>
            <span className="cur-mini-pct">{pct}%</span>
          </div>
        </div>
        <span className="cur-trigger-icon">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="cur-topics-grid">
          {chapter.topics.map(t => <TopicRow key={t.id} topic={t} />)}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CurriculumPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/curriculum"), { headers: { ...getAuthHeaders() } });
        const data = await parseJsonResponse<{ subjects: Subject[] }>(res);
        setSubjects(data.subjects || []);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.map(s => ({
      ...s,
      chapters: s.chapters.map(c => ({
        ...c,
        topics: c.topics.filter(t => t.name.toLowerCase().includes(q)),
      })).filter(c => c.topics.length > 0),
    })).filter(s => s.chapters.length > 0);
  }, [subjects, search]);

  const activeSubject = filtered[activeTab] ?? filtered[0];

  return (
    <div className="cur-root">
      <style>{`
        .cur-root { font-family: 'Outfit', sans-serif; background: var(--bg); min-height: 100vh; padding: 40px; }
        .cur-header { margin-bottom: 32px; }
        .cur-title { font-family: 'DM Serif Display', serif; font-size: 36px; color: var(--text); margin-bottom: 8px; }
        .cur-subtitle { color: var(--muted); font-size: 16px; }
        .cur-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 20px; }
        .cur-tabs { display: flex; gap: 8px; background: var(--card); padding: 6px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .cur-tab-btn { padding: 10px 20px; border: none; border-radius: 8px; background: transparent; color: var(--muted); font-weight: 600; cursor: pointer; transition: 0.2s; }
        .cur-tab-btn.active { background: #6366f1; color: #fff; box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
        .cur-search-input { padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); width: 300px; outline: none; transition: 0.2s; }
        .cur-search-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .cur-subject-box { background: var(--card); padding: 24px; border-radius: 20px; border: 1px solid var(--border); margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
        .cur-subject-name-l { font-family: 'DM Serif Display', serif; font-size: 28px; color: var(--text); margin: 0 0 6px; }
        .cur-group-timeline { display: flex; gap: 14px; font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 4px; }
        .cur-group-timeline.large { font-size: 13px; color: var(--muted); margin: 0; }
        .cur-chapter-container { margin-bottom: 24px; }
        .cur-chapter-trigger { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; cursor: pointer; transition: 0.2s; }
        .cur-chapter-trigger:hover { border-color: var(--border-hover); }
        .cur-chapter-trigger.active { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .cur-chapter-info { text-align: left; flex: 1; }
        .cur-chapter-name { font-size: 18px; font-weight: 700; color: var(--text); margin-right: 12px; }
        .cur-chapter-badge { font-size: 12px; background: var(--card-hover); padding: 4px 10px; border-radius: 20px; color: var(--muted); }
        .cur-chapter-progress-mini { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
        .cur-mini-bar { width: 140px; height: 6px; background: var(--border); border-radius: 10px; }
        .cur-mini-fill { height: 100%; background: #6366f1; border-radius: 10px; transition: 0.5s; }
        .cur-mini-pct { font-size: 12px; font-weight: 700; color: #6366f1; }
        .cur-topics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; padding: 24px; background: var(--card); border: 1px solid var(--border); border-top: none; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; }
        .cur-topic-card { padding: 16px; border-radius: 14px; border: 1px solid var(--border); background: var(--card); transition: 0.3s; }
        .cur-topic-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.04); }
        .cur-topic-card.locked { opacity: 0.6; grayscale: 1; }
        .cur-topic-main { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
        .cur-topic-status-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .cur-topic-details { flex: 1; min-width: 0; }
        .cur-topic-name { font-weight: 700; font-size: 15px; color: var(--text); display: block; }
        .cur-topic-duration { font-size: 12px; color: var(--muted); }
        .cur-topic-timeline { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .cur-time-tag { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 5px; }
        .cur-time-tag.started { background: rgba(37,99,235,0.15); color: #2563eb; }
        .cur-time-tag.completed { background: rgba(5,150,105,0.15); color: #059669; }
        .cur-time-tag.last { background: rgba(161,98,7,0.15); color: #a16207; }
        .cur-action-btn { padding: 6px 12px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; background: var(--card-hover); color: var(--muted); transition: 0.2s; }
        .cur-action-btn:hover { background: var(--border); }
        .cur-action-btn.success { background: #10b981; color: #fff; }
        .cur-topic-progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border); padding-top: 10px; }
        .cur-progress-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
        .cur-progress-fill { height: 100%; transition: 0.6s; }
        .cur-mastery-label { font-size: 11px; font-weight: 800; color: var(--muted); }
        .cur-subj-complete { background: #10b981; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; }
      `}</style>

      <header className="cur-header">
        <h1 className="cur-title">Learning Journey</h1>
        <p className="cur-subtitle">Track your progress across all subjects</p>
      </header>

      <section className="cur-controls">
        <div className="cur-tabs">
          {filtered.map((s, i) => (
            <button key={s.id} onClick={() => setActiveTab(i)} className={`cur-tab-btn ${i === activeTab ? 'active' : ''}`}>{s.name}</button>
          ))}
        </div>
        <input className="cur-search-input" placeholder="🔍 Search topics..." value={search} onChange={e => setSearch(e.target.value)} />
      </section>

      <main className="cur-main">
        {!loading && activeSubject ? (
          <>
            <div className="cur-subject-box">
               <div>
                  <h2 className="cur-subject-name-l">{activeSubject.name}</h2>
                  <div className="cur-group-timeline large">
                     {activeSubject.startedAt && <span>🚀 Started: <b>{formatDate(activeSubject.startedAt)}</b></span>}
                     {activeSubject.lastStudiedAt && <span>🕒 Last active: <b>{formatDate(activeSubject.lastStudiedAt)}</b></span>}
                  </div>
               </div>
               {activeSubject.completedAt && <div className="cur-subj-complete">✓ Mastered on {formatDate(activeSubject.completedAt)}</div>}
            </div>
            {activeSubject.chapters.map(ch => <ChapterBlock key={ch.id} chapter={ch} />)}
          </>
        ) : <p>Loading curriculum...</p>}
      </main>
    </div>
  );
}