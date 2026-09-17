"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

type Subject = { id: string; name: string; chapters: Chapter[] };
type Chapter = { id: string; name: string; topics: Topic[] };
type Topic = { id: string; name: string; state: string };

type QuizQuestion = { itemId: string; prompt: string; options: string[] };
type StartResponse = { assessmentId: string; label: string; questions: QuizQuestion[] };
type AnswerResponse = { isCorrect: boolean; correctIndex: number; explanation: string };
type FinishResponse = { score: number; correctCount: number; totalQuestions: number };

type Stage = "picker" | "ready" | "starting" | "in_progress" | "completed" | "error";

function AssessmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");
  const chapterId = searchParams.get("chapterId");
  const initialLabel = searchParams.get("label") || "";

  const [stage, setStage] = useState<Stage>(topicId || chapterId ? "ready" : "picker");
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(initialLabel);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);

  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);
  const [answering, setAnswering] = useState(false);
  const [report, setReport] = useState<FinishResponse | null>(null);

  useEffect(() => {
    if (stage !== "picker") return;
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/curriculum"), { headers: { ...getAuthHeaders() } });
        const data = await parseJsonResponse<{ subjects: Subject[] }>(res);
        setSubjects(data.subjects || []);
      } catch {
        setError("Could not load your curriculum. Please try again.");
      } finally {
        setPickerLoading(false);
      }
    })();
  }, [stage]);

  async function startQuiz() {
    setStage("starting");
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/assessments/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(topicId ? { topicId, count: 5 } : { chapterId, count: 8 }),
      });
      const data = await parseJsonResponse<StartResponse & { detail?: string }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "Could not start the quiz."));
        setStage("error");
        return;
      }
      setAssessmentId(data.assessmentId);
      setQuestions(data.questions);
      setLabel(data.label);
      setIndex(0);
      setSelected(null);
      setFeedback(null);
      setStage("in_progress");
    } catch {
      setError("Network error while starting the quiz.");
      setStage("error");
    }
  }

  async function submitAnswer(optionIndex: number) {
    if (!assessmentId || answering || feedback) return;
    setSelected(optionIndex);
    setAnswering(true);
    try {
      const current = questions[index];
      const res = await fetch(getApiUrl(`/api/assessments/${assessmentId}/answer`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ itemId: current.itemId, selectedIndex: optionIndex }),
      });
      const data = await parseJsonResponse<AnswerResponse & { detail?: string }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "Could not submit your answer."));
        return;
      }
      setFeedback(data);
    } catch {
      setError("Network error while submitting your answer.");
    } finally {
      setAnswering(false);
    }
  }

  async function nextOrFinish() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
      setFeedback(null);
      return;
    }
    if (!assessmentId) return;
    try {
      const res = await fetch(getApiUrl(`/api/assessments/${assessmentId}/finish`), {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
      const data = await parseJsonResponse<FinishResponse & { detail?: string }>(res);
      if (!res.ok) {
        setError(getApiErrorMessage(data, "Could not finish the quiz."));
        return;
      }
      setReport(data);
      setStage("completed");
    } catch {
      setError("Network error while finishing the quiz.");
    }
  }

  const activeSubjectTopics = useMemo(
    () => subjects.flatMap(s => s.chapters.map(c => ({ subject: s, chapter: c }))),
    [subjects]
  );

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 40 }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color: "#0f172a", marginBottom: 8 }}>
          Quizzes
        </h1>
        <p style={{ color: "#64748b", fontSize: 16 }}>Test what you&apos;ve learned and see your weak areas.</p>
      </header>

      {error && stage !== "error" && (
        <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 14 }}>
          {error}
        </div>
      )}

      {stage === "picker" && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Pick a topic to quiz yourself on</h2>
          {pickerLoading ? (
            <p style={{ color: "#94a3b8" }}>Loading your curriculum…</p>
          ) : activeSubjectTopics.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No curriculum found yet. Visit the Curriculum page first.</p>
          ) : (
            activeSubjectTopics.map(({ subject, chapter }) => (
              <div key={chapter.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", marginBottom: 8 }}>
                  {subject.name} · {chapter.name}
                  {chapter.topics.some(t => t.state !== "locked") && (
                    <button
                      onClick={() => router.push(`/dashboard/assessments?chapterId=${chapter.id}&label=${encodeURIComponent(chapter.name)}`)}
                      style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#eef2ff", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}
                    >
                      Quiz whole chapter
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {chapter.topics.filter(t => t.state !== "locked").map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => router.push(`/dashboard/assessments?topicId=${topic.id}&label=${encodeURIComponent(topic.name)}`)}
                      style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {(stage === "ready" || stage === "starting") && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>{label || "Quiz"}</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
            {chapterId ? "A mixed quiz covering this chapter's topics." : "A short quiz on this topic."}
          </p>
          <button
            onClick={startQuiz}
            disabled={stage === "starting"}
            style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {stage === "starting" ? "Preparing questions…" : "Start Quiz →"}
          </button>
        </div>
      )}

      {stage === "error" && (
        <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{error}</p>
          <Link href="/dashboard/curriculum" style={{ color: "#6366f1", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            ← Back to Curriculum
          </Link>
        </div>
      )}

      {stage === "in_progress" && questions[index] && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 28, maxWidth: 640 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10 }}>
            {label} · Question {index + 1} of {questions.length}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20 }}>{questions[index].prompt}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions[index].options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrectOpt = feedback && i === feedback.correctIndex;
              const isWrongSelected = feedback && isSelected && !feedback.isCorrect;
              const bg = isCorrectOpt ? "#ecfdf5" : isWrongSelected ? "#fef2f2" : isSelected ? "#eef2ff" : "#f8fafc";
              const border = isCorrectOpt ? "#059669" : isWrongSelected ? "#dc2626" : isSelected ? "#6366f1" : "#e2e8f0";
              return (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  disabled={!!feedback || answering}
                  style={{ textAlign: "left", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, color: "#1e293b", fontSize: 14, cursor: feedback ? "default" : "pointer" }}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 10, background: feedback.isCorrect ? "#ecfdf5" : "#fef2f2" }}>
              <p style={{ fontWeight: 700, color: feedback.isCorrect ? "#059669" : "#dc2626", marginBottom: 4, fontSize: 14 }}>
                {feedback.isCorrect ? "Correct!" : "Not quite."}
              </p>
              {feedback.explanation && <p style={{ fontSize: 13, color: "#475569" }}>{feedback.explanation}</p>}
              <button
                onClick={nextOrFinish}
                style={{ marginTop: 12, padding: "9px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {index + 1 < questions.length ? "Next question →" : "See results →"}
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "completed" && report && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{report.score >= 80 ? "🏆" : report.score >= 50 ? "👍" : "📚"}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>{report.score}%</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
            {report.correctCount} out of {report.totalQuestions} correct on <strong>{label}</strong>
            {report.score >= 80 ? " — mastery updated!" : ". Keep practicing this topic to improve mastery."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/dashboard/curriculum" style={{ padding: "10px 20px", borderRadius: 8, background: "#f1f5f9", color: "#334155", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Back to Curriculum
            </Link>
            <Link href="/dashboard/assessments" style={{ padding: "10px 20px", borderRadius: 8, background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Take Another Quiz
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssessmentsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fafc" }} />}>
      <AssessmentsContent />
    </Suspense>
  );
}
