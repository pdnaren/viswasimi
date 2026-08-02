"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import {
  Send, ChevronLeft, ChevronRight, PlayCircle, CheckCircle2,
  Lock, AlertCircle, ArrowRightCircle, Mic, Volume2, VolumeX,
  Target,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm    from "remark-gfm";
import remarkMath   from "remark-math";
import rehypeKatex  from "rehype-katex";
import { useSpeech } from "@/app/hooks/useSpeech";

// ─── Types ────────────────────────────────────────────────────────────────────
type Topic    = { id: string; name: string; state: "done"|"in_progress"|"available"|"locked"; durationM: number; mastery: number };
type Chapter  = { id: string; name: string; topics: Topic[] };
type Subject  = { id: string; name: string; chapters: Chapter[] };
type PlanItem = { id: string; topicId: string; topicName: string; state: string };

interface Message {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  createdAt?:  string;
  /** If this assistant message ended with a [CHECKPOINT] question, store it here */
  checkpoint?: string;
  /** After grading, store the result. undefined = not graded yet, null = NA (no score) */
  gradeResult?: { correct: boolean; score: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getChapterStatus = (c: Chapter) => {
  if (!c.topics.length) return "available";
  if (c.topics.every(t => t.state === "done")) return "done";
  if (c.topics.some(t => t.state === "done" || t.state === "in_progress")) return "in_progress";
  if (c.topics.every(t => t.state === "locked")) return "locked";
  return "available";
};

const getSubjectStatus = (s: Subject) => {
  if (!s.chapters.length) return "available";
  const st = s.chapters.map(getChapterStatus);
  if (st.every(x => x === "done")) return "done";
  if (st.some(x => x === "done" || x === "in_progress")) return "in_progress";
  return "available";
};

const STATUS_EMOJI: Record<string, string> = {
  done:        "✅",
  in_progress: "🔄",
  available:   "⚪",
  locked:      "🔒",
};

/**
 * Extract the [CHECKPOINT] question from an AI message.
 * Returns { cleanContent, checkpoint } where cleanContent has the tag removed
 * and checkpoint is the question string (or null).
 */
function extractCheckpoint(raw: string): { cleanContent: string; checkpoint: string | null } {
  const rx = /\[CHECKPOINT\]([\s\S]*?)\[\/CHECKPOINT\]/i;
  const m  = raw.match(rx);
  if (!m) return { cleanContent: raw, checkpoint: null };
  return {
    cleanContent: raw.replace(rx, "").trim(),
    checkpoint:   m[1].trim(),
  };
}

/**
 * Normalise math delimiters from LLM output to KaTeX-compatible format.
 */
function normaliseMath(text: string): string {
  return text
    .replace(/\\\[/g, "\n$$\n")
    .replace(/\\\]/g, "\n$$\n")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}

// ─── Page-image viewer modal ──────────────────────────────────────────────────
function PageImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -12, right: -12, width: 32, height: 32,
            borderRadius: "50%", border: "none", background: "#fff",
            fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >×</button>
        <img
          src={src}
          alt="Textbook page"
          style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
        />
      </div>
    </div>
  );
}

// ─── Checkpoint feedback banner ───────────────────────────────────────────────
function CheckpointBanner({ correct }: { correct: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 18px", borderRadius: 12, margin: "8px 0",
      background: correct ? "#ecfdf5" : "#fef2f2",
      border: `1px solid ${correct ? "#a7f3d0" : "#fecaca"}`,
      color: correct ? "#065f46" : "#991b1b",
      fontSize: 14, fontWeight: 600, alignSelf: "flex-start",
    }}>
      {correct ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
      {correct ? "Correct! Well done 🎉" : "Not quite — keep going, you'll get it! 💪"}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────
function ChatContent() {
  const searchParams = useSearchParams();
  const urlTopicId   = searchParams.get("topicId");

  const [subjects,         setSubjects]         = useState<Subject[]>([]);
  const [planItems,        setPlanItems]         = useState<PlanItem[]>([]);
  const [selectedSubjId,   setSelectedSubjId]   = useState("");
  const [selectedChapId,   setSelectedChapId]   = useState("");
  const [selectedTopicId,  setSelectedTopicId]  = useState("");

  const [messages,         setMessages]          = useState<Message[]>([{
    id: "welcome", role: "assistant",
    content: "Hi! I'm your Viswasimi AI tutor. Select a topic to begin — I'll teach you page by page and quiz you along the way! 🎓",
  }]);
  const [prompt,           setPrompt]            = useState("");
  const [loading,          setLoading]           = useState(false);
  const [error,            setError]             = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed]  = useState(false);

  // Guided mode state
  const [tutorMode,          setTutorMode]          = useState<"qa"|"guided">("qa");
  const [currentChunkIndex,  setCurrentChunkIndex]  = useState(0);

  // Page image modal
  const [modalImageSrc,    setModalImageSrc]     = useState<string | null>(null);

  // Pending checkpoint state:
  // - pendingCheckpoint: the question text from [CHECKPOINT] tag
  // - checkpointMsgId:   the assistant message ID that has the checkpoint
  // Both are cleared after grading completes
  const [pendingCheckpoint, setPendingCheckpoint] = useState<string | null>(null);
  const [checkpointMsgId,   setCheckpointMsgId]   = useState<string | null>(null);
  const [gradingInProgress, setGradingInProgress] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);
  const {
    isListening, isSpeaking, voiceEnabled, setVoiceEnabled,
    startListening, speakText, stopSpeaking,
  } = useSpeech();

  const userLocale = "en-IN";

  const selectedSubject = subjects.find(s => s.id === selectedSubjId);
  const selectedChapter = selectedSubject?.chapters.find(c => c.id === selectedChapId);
  const selectedTopic   = selectedChapter?.topics.find(t => t.id === selectedTopicId);
  const canChat         = selectedTopic?.state === "in_progress" || selectedTopic?.state === "done";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loading]);

  // ── Topic selector helper ─────────────────────────────────────────────────
  const selectTopicById = useCallback((tid: string, list: Subject[] = subjects) => {
    for (const s of list) {
      for (const c of s.chapters) {
        if (c.topics.find(t => t.id === tid)) {
          setSelectedSubjId(s.id);
          setSelectedChapId(c.id);
          setSelectedTopicId(tid);
          return true;
        }
      }
    }
    return false;
  }, [subjects]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [cr, pr] = await Promise.all([
        fetch(getApiUrl("/api/curriculum"),       { credentials: "include", headers: getAuthHeaders() }),
        fetch(getApiUrl("/api/study-plan/today"), { credentials: "include", headers: getAuthHeaders() }),
      ]);
      if (pr.ok) {
        const d = await parseJsonResponse<{ items: PlanItem[] }>(pr);
        setPlanItems(d.items || []);
      }
      if (cr.ok) {
        const d  = await parseJsonResponse<{ subjects: Subject[] }>(cr);
        const fs = d.subjects || [];
        setSubjects(fs);
        if (fs.length && !selectedSubjId) {
          let found = false;
          if (urlTopicId) found = selectTopicById(urlTopicId, fs);
          if (!found) {
            outer:
            for (const pri of ["in_progress", "available"] as const) {
              for (const s of fs) {
                for (const c of s.chapters) {
                  const t = c.topics.find(x => x.state === pri);
                  if (t) {
                    setSelectedSubjId(s.id);
                    setSelectedChapId(c.id);
                    setSelectedTopicId(t.id);
                    found = true;
                    break outer;
                  }
                }
              }
            }
            if (!found && fs[0]?.chapters[0]?.topics[0]) {
              setSelectedSubjId(fs[0].id);
              setSelectedChapId(fs[0].chapters[0].id);
              setSelectedTopicId(fs[0].chapters[0].topics[0].id);
            }
          }
        }
      }
    } catch {
      setError("Failed to load curriculum.");
    }
  }, [urlTopicId, selectedSubjId, selectTopicById]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load chat history when topic changes ───────────────────────────────────
  useEffect(() => {
    if (!selectedTopicId) {
      setMessages([{
        id: "welcome", role: "assistant",
        content: "Hi! I'm your Viswasimi AI tutor. Select a topic to begin — I'll teach you page by page and quiz you along the way! 🎓",
      }]);
      return;
    }

    // Reset all guided-mode state on topic change
    setTutorMode("qa");
    setCurrentChunkIndex(0);
    setPendingCheckpoint(null);
    setCheckpointMsgId(null);
    stopSpeaking();
    setLoading(true);

    fetch(getApiUrl(`/api/chat/history?topicId=${selectedTopicId}`), {
      credentials: "include",
      headers: getAuthHeaders(),
    })
      .then(r => r.json())
      .then(d => {
        if (d.messages?.length) {
          // Re-parse checkpoint tags from saved history
          setMessages(d.messages.map((m: Message) => {
            if (m.role !== "assistant") return m;
            const { cleanContent, checkpoint } = extractCheckpoint(m.content);
            return { ...m, content: normaliseMath(cleanContent), checkpoint: checkpoint || undefined };
          }));
        } else {
          setMessages([{
            id: `sys-${Date.now()}`, role: "assistant",
            content: `Ready to learn **${selectedTopic?.name}**! Click **Start Session** to begin. 📚`,
          }]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedTopicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mic handler ───────────────────────────────────────────────────────────
  const handleMicClick = () => {
    if (isListening) return;
    startListening(userLocale, t => setPrompt(p => p ? p + " " + t : t));
  };

  // ── Grade a checkpoint answer ─────────────────────────────────────────────
  const gradeAnswer = useCallback(async (
    question:    string,
    answer:      string,
    msgId:       string,
  ) => {
    if (!selectedTopicId || !question) return;
    setGradingInProgress(true);
    try {
      const res = await fetch(getApiUrl("/api/chat/grade"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topicId: selectedTopicId, question, answer }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update the message that had the checkpoint with the grade result
        setMessages(prev => prev.map(m =>
          m.id === msgId
            ? { ...m, gradeResult: data.graded ? { correct: data.correct, score: data.score } : null }
            : m
        ));
      }
    } catch (e) {
      console.error("Grade error", e);
    } finally {
      setGradingInProgress(false);
      // Always clear pending checkpoint after grading attempt
      setPendingCheckpoint(null);
      setCheckpointMsgId(null);
    }
  }, [selectedTopicId]);

  // ── Core streaming function ───────────────────────────────────────────────
  const streamChatRequest = useCallback(async (
    userPromptText: string,
    overrideMode?:  "qa" | "guided",
    overrideIndex?: number,
  ) => {
    if (loading) return;

    const activeMode  = overrideMode  ?? tutorMode;
    const activeIndex = overrideIndex ?? currentChunkIndex;

    // If there's a pending checkpoint, grade the current answer before proceeding
    const capturedCheckpoint = pendingCheckpoint;
    const capturedMsgId      = checkpointMsgId;

    // Build user message list (add user turn if there's text)
    const newMsgs = [...messages];
    if (userPromptText) {
      newMsgs.push({ id: `u-${Date.now()}`, role: "user", content: userPromptText });
      setPrompt("");

      // Save user message to DB
      if (selectedTopicId) {
        fetch(getApiUrl("/api/chat/save"), {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ topicId: selectedTopicId, role: "user", content: userPromptText }),
        }).catch(() => {});
      }
    }

    // Add empty assistant placeholder
    const aId = `a-${Date.now()}`;
    newMsgs.push({ id: aId, role: "assistant", content: "" });
    setMessages(newMsgs);
    setLoading(true);
    setError(null);
    stopSpeaking();

    // Grade the pending checkpoint in parallel with starting the new request
    if (capturedCheckpoint && capturedMsgId && userPromptText) {
      gradeAnswer(capturedCheckpoint, userPromptText, capturedMsgId).catch(() => {});
    }

    try {
      const res = await fetch(getApiUrl("/api/chat/respond"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          topicId:             selectedTopicId || null,
          topicName:           selectedTopic?.name   || "",
          chapterId:           selectedChapter?.id   || "",
          chapterName:         selectedChapter?.name || "",
          subjectName:         selectedSubject?.name || "",
          prompt:              userPromptText,
          history:             messages.map(m => ({ role: m.role, content: m.content })),
          mode:                activeMode,
          current_chunk_index: activeIndex,
        }),
      });

      if (res.status === 403) {
        const e = await res.json();
        setError(e.detail || "Daily limit reached.");
        setMessages(p => p.filter(m => m.id !== aId));
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream unavailable");

      const dec = new TextDecoder();
      let full  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = dec.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const ds = line.slice(6).trim();

          if (ds === "[DONE]") {
            // ── Stream finished: parse checkpoint and save ──────────────────
            const { cleanContent, checkpoint } = extractCheckpoint(full);
            const display = normaliseMath(cleanContent);

            setMessages(prev => prev.map(m =>
              m.id === aId
                ? { ...m, content: display, checkpoint: checkpoint || undefined }
                : m
            ));

            // Set up the pending checkpoint for the user's next reply
            if (checkpoint) {
              setPendingCheckpoint(checkpoint);
              setCheckpointMsgId(aId);
            }

            // Persist assistant message (without [CHECKPOINT] tags)
            if (selectedTopicId && display) {
              fetch(getApiUrl("/api/chat/save"), {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ topicId: selectedTopicId, role: "assistant", content: display }),
              }).catch(() => {});

              speakText(display, userLocale);
            }
            return;
          }

          try {
            const parsed = JSON.parse(ds);
            const chunk  = parsed.choices?.[0]?.delta?.content;
            if (!chunk) continue;

            // Handle [TOPIC_COMPLETED] signal from the RAG service
            if (chunk.includes("[TOPIC_COMPLETED]")) {
              setMessages(p => p.filter(m => m.id !== aId));
              await handleCompleteTopic();
              return;
            }

            full += chunk;

            // Don't render partial image tags — wait until the URL is complete
            if (full.includes("![") && !full.includes(")")) {
              continue;
            }

            // Show progressive content (checkpoint tags will be cleaned on [DONE])
            const disp = normaliseMath(full);
            setMessages(prev => prev.map(m =>
              m.id === aId ? { ...m, content: disp } : m
            ));
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response.");
      setMessages(p => p.filter(m => m.id !== aId));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading, tutorMode, currentChunkIndex, messages,
    selectedTopicId, selectedTopic, selectedChapter, selectedSubject,
    pendingCheckpoint, checkpointMsgId, gradeAnswer, speakText, stopSpeaking,
  ]);

  // ── Session actions ───────────────────────────────────────────────────────
  const handleStartSession = async () => {
    if (!selectedTopic) return;

    const planItem   = planItems.find(p => p.topicId === selectedTopic.id);
    const isResume   = selectedTopic.state === "in_progress" || planItem?.state === "IN_PROGRESS";

    // Resume: re-enter guided mode at the last approximate position
    if (isResume && tutorMode === "qa") {
      const assistantTurns = messages.filter(m => m.role === "assistant" && m.content.length > 100).length;
      const idx = Math.max(0, assistantTurns - 1);
      setTutorMode("guided");
      setCurrentChunkIndex(idx);
      await streamChatRequest("Please resume teaching from where we left off.", "guided", idx);
      return;
    }

    // New session: log STARTED, bump mastery, create/update plan item
    await fetch(getApiUrl("/api/progress/log"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ topicId: selectedTopic.id, event: "STARTED", score: 0, seconds: 0 }),
    });
    await fetch(getApiUrl("/api/mastery/update"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ topicId: selectedTopic.id, increment: 1 }),
    });

    let item = planItem;
    if (!item) {
      const now = new Date();
      await fetch(getApiUrl("/api/study-plan/add-item"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          topicId:       selectedTopic.id,
          startsAt:      now.toISOString(),
          endsAt:        new Date(now.getTime() + (selectedTopic.durationM || 30) * 60000).toISOString(),
          targetMastery: 5,
        }),
      });
      const pr = await fetch(getApiUrl("/api/study-plan/today"), {
        credentials: "include", headers: getAuthHeaders(),
      });
      if (pr.ok) {
        const d = await parseJsonResponse<{ items: PlanItem[] }>(pr);
        item = d.items?.find(p => p.topicId === selectedTopic.id);
        setPlanItems(d.items || []);
      }
    }

    if (item && item.state !== "IN_PROGRESS") {
      await fetch(getApiUrl(`/api/study-plan/item/${item.id}/state`), {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ state: "IN_PROGRESS" }),
      });
    }

    setTutorMode("guided");
    setCurrentChunkIndex(0);
    await streamChatRequest("Please teach me the first page of this topic.", "guided", 0);
    await fetchData();
  };

  const handleNextSection = async () => {
    const next = currentChunkIndex + 1;
    setCurrentChunkIndex(next);
    // "I am ready" is the trigger phrase the RAG service uses to detect Next Page button
    await streamChatRequest("I am ready. Please teach the next page.", "guided", next);
  };

  const handleCompleteTopic = useCallback(async () => {
    if (!selectedTopic) return;

    await Promise.all([
      fetch(getApiUrl("/api/progress/log"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topicId: selectedTopic.id, event: "COMPLETED", score: 0, seconds: 0 }),
      }),
      fetch(getApiUrl("/api/mastery/update"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topicId: selectedTopic.id, increment: 5 }),
      }),
      fetch(getApiUrl("/api/progress/daily-update"), {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ topicsCompleted: 1, minutes: selectedTopic.durationM || 30 }),
      }),
    ]);

    const pi = planItems.find(p => p.topicId === selectedTopic.id);
    if (pi) {
      await fetch(getApiUrl(`/api/study-plan/item/${pi.id}/state`), {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ state: "DONE" }),
      });
    }

    setTutorMode("qa");
    setPendingCheckpoint(null);
    setCheckpointMsgId(null);

    const done = `🎉 Amazing work completing **${selectedTopic.name}**! Your accuracy has been recorded. Select a new topic or ask me any questions about this one.`;
    setMessages(p => [...p, { id: `sys-${Date.now()}`, role: "assistant", content: done }]);
    speakText(done, userLocale);
    await fetchData();
  }, [selectedTopic, planItems, speakText, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {modalImageSrc && (
        <PageImageModal src={modalImageSrc} onClose={() => setModalImageSrc(null)} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Lora:wght@500;600&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes pulseGreen{0%{box-shadow:0 0 0 0 rgba(16,185,129,.4)}70%{box-shadow:0 0 0 6px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
        @keyframes pulsePurple{0%{box-shadow:0 0 0 0 rgba(139,92,246,.4)}70%{box-shadow:0 0 0 8px rgba(139,92,246,0)}100%{box-shadow:0 0 0 0 rgba(139,92,246,0)}}
        *,*::before,*::after{box-sizing:border-box}
        .vw-root{font-family:'DM Sans',sans-serif;display:flex;height:100vh;width:100%;background:#f8fafc;overflow:hidden;color:#1e293b}
        /* sidebar */
        .vw-sb{display:flex;flex-direction:column;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;transition:width .3s ease;position:relative;height:100%;z-index:10}
        .vw-sb.exp{width:320px;min-width:320px}.vw-sb.col{width:68px;min-width:68px}
        .vw-sb-inner{display:flex;flex-direction:column;height:100%;overflow:hidden;padding:20px;width:320px}
        .vw-sb.col .vw-sb-inner{width:68px;padding:20px 0;align-items:center}
        .vw-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px;flex-shrink:0}
        .vw-logo{width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#4f6ef7,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;box-shadow:0 4px 14px rgba(79,110,247,.3);flex-shrink:0}
        .vw-brand-name{font-size:18px;font-weight:700;font-family:'Lora',serif;color:#0f172a}
        .vw-brand-sub{font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
        .vw-sec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin:20px 0 8px;display:block}
        .vw-plan-list{display:flex;flex-direction:column;gap:6px}
        .vw-plan-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;cursor:pointer;transition:all .2s;font-size:13px;font-weight:600;color:#334155}
        .vw-plan-item:hover{background:#f8fafc;border-color:#cbd5e1;transform:translateY(-1px)}
        .vw-plan-item.active{background:#eff6ff;border-color:#bfdbfe;color:#2563eb;box-shadow:inset 3px 0 0 #3b82f6}
        .vw-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
        .vw-dot.done{background:#10b981}.vw-dot.prog{background:#6366f1}.vw-dot.sched{background:#cbd5e1}
        .vw-sel{width:100%;padding:10px 32px 10px 12px;border-radius:9px;border:1px solid #e2e8f0;background:#f8fafc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748b' d='M5 6L0 0h10z'/%3E%3C/svg%3E") no-repeat right 12px center;font-size:13px;font-weight:500;color:#1e293b;cursor:pointer;outline:none;appearance:none;transition:.2s;margin-bottom:8px}
        .vw-sel:focus{border-color:#4f6ef7;box-shadow:0 0 0 3px rgba(79,110,247,.15);background-color:#fff}
        .vw-sel:disabled{opacity:.6;cursor:not-allowed;background-color:#f1f5f9}
        .vw-toggle{position:absolute;right:-13px;top:28px;width:26px;height:26px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:20;color:#64748b;transition:all .2s}
        .vw-toggle:hover{color:#0f172a;border-color:#cbd5e1}
        .vw-sb-scroll{flex:1;overflow-y:auto;display:flex;flex-direction:column}
        .vw-sb-scroll::-webkit-scrollbar{width:4px}.vw-sb-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
        /* main */
        .vw-main{flex:1;display:flex;flex-direction:column;min-width:0;background:#f8fafc}
        .vw-header{padding:12px 20px;border-bottom:1px solid #e2e8f0;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;flex-shrink:0;z-index:5}
        .vw-h-title{margin:0;font-size:17px;font-weight:700;color:#0f172a;font-family:'Lora',serif}
        .vw-h-sub{margin:2px 0 0;font-size:12px;color:#64748b;font-weight:500}
        .vw-h-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .vw-h-actions{display:flex;align-items:center;gap:8px}
        .vw-btn-voice{padding:5px 10px;border-radius:99px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;transition:.2s}
        .vw-btn-voice.on{background:#eff6ff;color:#3b82f6;border-color:#bfdbfe}
        .vw-btn-start{padding:7px 14px;border-radius:9px;border:none;background:#4f6ef7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(79,110,247,.25)}
        .vw-btn-start:hover:not(:disabled){background:#3b5bdb;transform:translateY(-1px)}.vw-btn-start:disabled{opacity:.6;cursor:not-allowed}
        .vw-btn-next{padding:7px 14px;border-radius:9px;border:none;background:#8b5cf6;color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(139,92,246,.25)}
        .vw-btn-next:hover:not(:disabled){background:#7c3aed;transform:translateY(-1px)}.vw-btn-next:disabled{opacity:.6;cursor:not-allowed}
        .vw-btn-done{padding:7px 14px;border-radius:9px;border:none;background:#10b981;color:#fff;font-size:12px;font-weight:600;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(16,185,129,.25)}
        .vw-btn-done:hover:not(:disabled){background:#059669;transform:translateY(-1px)}.vw-btn-done:disabled{opacity:.6;cursor:not-allowed}
        .vw-status{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600}
        .vw-status.online{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0}
        .vw-status.thinking{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe}
        .vw-status-dot{width:7px;height:7px;border-radius:50%}
        .online .vw-status-dot{background:#10b981;animation:pulseGreen 2s infinite}
        .thinking .vw-status-dot{background:#3b82f6;animation:bounce 1.4s infinite}
        /* messages */
        .vw-msgs{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;position:relative}
        .vw-msgs::-webkit-scrollbar{width:5px}.vw-msgs::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:5px}
        .vw-speaking{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:#8b5cf6;background:#ede9fe;border:1px solid #ddd6fe;padding:5px 14px;border-radius:99px;align-self:flex-start;margin-left:44px;box-shadow:0 2px 8px rgba(139,92,246,.15)}
        .vw-row{display:flex;flex-direction:column;width:100%}
        .vw-row.user{align-items:flex-end}.vw-row.assistant{align-items:flex-start}
        .vw-row.new{animation:fadeUp .4s cubic-bezier(.16,1,.3,1) forwards}
        .vw-inner{display:flex;align-items:flex-end;gap:10px;max-width:88%}
        .vw-row.user .vw-inner{flex-direction:row-reverse}
        .vw-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.1)}
        .vw-av.user{background:linear-gradient(135deg,#334155,#0f172a)}.vw-av.ai{background:linear-gradient(135deg,#4f6ef7,#7c3aed)}
        .vw-bubble{padding:14px 18px;line-height:1.65;font-size:14px;word-break:break-word;box-shadow:0 4px 12px rgba(0,0,0,.04)}
        .vw-bubble.user{border-radius:18px 18px 4px 18px;background:linear-gradient(135deg,#4f6ef7,#7c3aed);color:#fff;border:1px solid rgba(0,0,0,.05)}
        .vw-bubble.assistant{border-radius:18px 18px 18px 4px;background:#fff;color:#1e293b;border:1px solid #e2e8f0}
        .vw-bubble p{margin:0 0 8px}.vw-bubble p:last-child,.vw-bubble p:empty{margin:0}
        .vw-bubble ul,.vw-bubble ol{margin:6px 0 10px;padding-left:20px}.vw-bubble li{margin-bottom:5px}
        .vw-bubble strong{font-weight:700}
        .vw-bubble code{background:rgba(0,0,0,.06);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px}
        .vw-bubble pre{background:rgba(0,0,0,.06);padding:10px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0}
        .vw-bubble.user code,.vw-bubble.user pre{background:rgba(255,255,255,.2)}
        .vw-bubble table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
        .vw-bubble th,.vw-bubble td{border:1px solid #cbd5e1;padding:8px 12px;text-align:left}
        .vw-bubble th{background:#f1f5f9;font-weight:700}
        .vw-bubble tr:nth-child(even){background:#f8fafc}
        .vw-bubble img{display:block;max-width:100%;height:auto;border-radius:10px;margin:14px auto;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,.08);background:#fff;cursor:zoom-in}
        /* checkpoint question box */
        .vw-checkpoint{margin-top:14px;padding:14px 16px;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#f5f3ff);border:2px solid #c7d2fe;font-size:14px;font-weight:600;color:#3730a3}
        .vw-checkpoint-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin-bottom:6px;display:flex;align-items:center;gap:5px}
        /* typing indicator */
        .vw-typing{display:flex;align-items:flex-end;gap:10px;animation:fadeUp .3s ease}
        .vw-typing-bubble{padding:16px 20px;border-radius:18px 18px 18px 4px;background:#fff;border:1px solid #e2e8f0;display:flex;gap:5px;align-items:center}
        .vw-dot-t{width:7px;height:7px;border-radius:50%;background:#94a3b8}
        .vw-dot-t:nth-child(1){animation:bounce 1.4s 0s infinite}
        .vw-dot-t:nth-child(2){animation:bounce 1.4s .2s infinite}
        .vw-dot-t:nth-child(3){animation:bounce 1.4s .4s infinite}
        /* input bar */
        .vw-bar{padding:14px 20px;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);border-top:1px solid #e2e8f0;flex-shrink:0;z-index:5}
        .vw-err{display:flex;align-items:center;gap:7px;padding:9px 12px;margin-bottom:10px;border-radius:9px;background:#fef2f2;border:1px solid #fecaca;color:#ef4444;font-size:12px;font-weight:500}
        /* checkpoint prompt in input area */
        .vw-cp-prompt{background:linear-gradient(135deg,#eff6ff,#f5f3ff);border:2px solid #c7d2fe;border-radius:12px;padding:12px 16px;margin-bottom:10px;font-size:13px;color:#3730a3;font-weight:600}
        .vw-cp-prompt .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6366f1;margin-bottom:4px}
        .vw-input-row{display:flex;gap:8px;align-items:center}
        .vw-input-wrap{flex:1;position:relative;display:flex;align-items:center}
        .vw-input{width:100%;padding:11px 14px;border-radius:11px;border:2px solid #e2e8f0;font-size:13px;background:#fff;outline:none;font-family:'DM Sans',sans-serif;transition:.2s;box-shadow:0 2px 8px rgba(0,0,0,.02)}
        .vw-input:focus{border-color:#4f6ef7;box-shadow:0 0 0 3px rgba(79,110,247,.1)}
        .vw-input:disabled{background:#f1f5f9;border-color:#e2e8f0;color:#94a3b8}
        .vw-input-icon{position:absolute;left:12px;color:#94a3b8}
        .vw-mic{width:44px;height:44px;border-radius:11px;border:1px solid #e2e8f0;background:#fff;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;flex-shrink:0}
        .vw-mic:hover:not(:disabled){border-color:#cbd5e1;color:#0f172a;background:#f8fafc}
        .vw-mic.listening{background:#ef4444;border-color:#ef4444;color:#fff;animation:pulseGreen 1.5s infinite}
        .vw-mic:disabled{opacity:.6;cursor:not-allowed}
        .vw-send{padding:11px 22px;border-radius:11px;border:none;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;flex-shrink:0;transition:all .2s}
        .vw-send.on{background:linear-gradient(135deg,#4f6ef7,#7c3aed);color:#fff;box-shadow:0 4px 12px rgba(79,110,247,.25)}
        .vw-send.on:hover{transform:translateY(-1px)}.vw-send.off{background:#f1f5f9;color:#94a3b8;cursor:not-allowed;border:1px solid #e2e8f0}
        .vw-hint{margin:6px 0 0;font-size:11px;color:#64748b;text-align:center;font-weight:500}
      `}</style>

      <div className="vw-root">
        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <aside className={`vw-sb ${sidebarCollapsed ? "col" : "exp"}`}>
          <button className="vw-toggle" onClick={() => setSidebarCollapsed(s => !s)}>
            {sidebarCollapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}
          </button>
          <div className="vw-sb-inner">
            <div className="vw-brand">
              <div className="vw-logo">V</div>
              {!sidebarCollapsed && (
                <div>
                  <div className="vw-brand-name">Viswasimi</div>
                  <div className="vw-brand-sub">AI Tutor</div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <div className="vw-sb-scroll">
                <span className="vw-sec-label">Today&apos;s Plan</span>
                {planItems.length === 0
                  ? (
                    <div style={{ fontSize: 12, color: "#64748b", padding: "12px", background: "#f8fafc", borderRadius: 10, border: "1px dashed #cbd5e1", textAlign: "center" }}>
                      Nothing scheduled.
                    </div>
                  ) : (
                    <div className="vw-plan-list">
                      {planItems.map(item => (
                        <div
                          key={item.id}
                          className={`vw-plan-item ${item.topicId === selectedTopicId ? "active" : ""}`}
                          onClick={() => selectTopicById(item.topicId)}
                        >
                          <div className={`vw-dot ${item.state === "DONE" ? "done" : item.state === "IN_PROGRESS" ? "prog" : "sched"}`}/>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                            {item.topicName}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                <span className="vw-sec-label" style={{ marginTop: 20 }}>Browse Curriculum</span>
                <select
                  className="vw-sel"
                  value={selectedSubjId}
                  onChange={e => { setSelectedSubjId(e.target.value); setSelectedChapId(""); setSelectedTopicId(""); }}
                >
                  <option value="" disabled>Select Subject…</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {STATUS_EMOJI[getSubjectStatus(s)]} {s.name}
                    </option>
                  ))}
                </select>

                <select
                  className="vw-sel"
                  value={selectedChapId}
                  onChange={e => { setSelectedChapId(e.target.value); setSelectedTopicId(""); }}
                  disabled={!selectedSubjId}
                >
                  <option value="" disabled>Select Chapter…</option>
                  {selectedSubject?.chapters.map(c => (
                    <option key={c.id} value={c.id}>
                      {STATUS_EMOJI[getChapterStatus(c)]} {c.name}
                    </option>
                  ))}
                </select>

                <select
                  className="vw-sel"
                  value={selectedTopicId}
                  onChange={e => setSelectedTopicId(e.target.value)}
                  disabled={!selectedChapId}
                >
                  <option value="" disabled>Select Topic…</option>
                  {selectedChapter?.topics.map(t => (
                    <option key={t.id} value={t.id} disabled={t.state === "locked"}>
                      {STATUS_EMOJI[t.state]} {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CHAT ─────────────────────────────────────────────────────── */}
        <section className="vw-main">
          <header className="vw-header">
            <div>
              <h2 className="vw-h-title">Chat with Tutor</h2>
              <p className="vw-h-sub">
                {selectedTopic ? `📖 ${selectedTopic.name}` : "Select a topic to begin"}
              </p>
            </div>
            <div className="vw-h-right">
              <button
                className={`vw-btn-voice ${voiceEnabled ? "on" : ""}`}
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeaking(); }}
              >
                {voiceEnabled ? <Volume2 size={14}/> : <VolumeX size={14}/>}
                {voiceEnabled ? "Voice ON" : "Voice OFF"}
              </button>

              {selectedTopic && (() => {
                const pi         = planItems.find(p => p.topicId === selectedTopic.id);
                const inProgress = selectedTopic.state === "in_progress" || pi?.state === "IN_PROGRESS";
                const showStart  = !inProgress && selectedTopic.state !== "locked";
                return (
                  <div className="vw-h-actions">
                    {showStart && (
                      <button className="vw-btn-start" onClick={handleStartSession} disabled={loading}>
                        <PlayCircle size={14}/>
                        {selectedTopic.state === "done" ? "Repeat Session" : "Start Session"}
                      </button>
                    )}
                    {inProgress && tutorMode === "qa" && (
                      <button className="vw-btn-start" onClick={handleStartSession} disabled={loading}>
                        <PlayCircle size={14}/>Resume Session
                      </button>
                    )}
                    {tutorMode === "guided" && canChat && (
                      <button
                        className="vw-btn-next"
                        onClick={handleNextSection}
                        disabled={loading || !!pendingCheckpoint || gradingInProgress}
                        title={pendingCheckpoint ? "Answer the checkpoint question first" : ""}
                      >
                        Next Page <ArrowRightCircle size={14}/>
                      </button>
                    )}
                    {inProgress && (
                      <button className="vw-btn-done" onClick={handleCompleteTopic} disabled={loading}>
                        <CheckCircle2 size={14}/>Mark Done
                      </button>
                    )}
                  </div>
                );
              })()}

              {selectedTopic && (
                <div className={`vw-status ${loading ? "thinking" : "online"}`}>
                  <span className="vw-status-dot"/>
                  {loading ? "Thinking…" : "Online"}
                </div>
              )}
            </div>
          </header>

          {/* Messages */}
          <div className="vw-msgs" ref={chatBoxRef}>
            {messages.map((msg, idx) => {
              // Show typing indicator for empty assistant placeholder
              if (msg.role === "assistant" && msg.content === "") {
                return (
                  <div key={msg.id} className="vw-typing">
                    <div className="vw-av ai">V</div>
                    <div className="vw-typing-bubble">
                      <span className="vw-dot-t"/><span className="vw-dot-t"/><span className="vw-dot-t"/>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`vw-row ${msg.role} ${idx === messages.length - 1 ? "new" : ""}`}>
                  <div className="vw-inner">
                    <div className={`vw-av ${msg.role === "user" ? "user" : "ai"}`}>
                      {msg.role === "user" ? "U" : "V"}
                    </div>
                    <div>
                      <div className={`vw-bubble ${msg.role === "user" ? "user" : "assistant"}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            img: ({ src, alt }) => (
                              <img
                                src={typeof src === "string" ? src : ""}
                                alt={alt || "Diagram"}
                                loading="lazy"
                                style={{ maxWidth: "100%", borderRadius: 12, cursor: "zoom-in", marginTop: 12 }}
                                onClick={() => {
                                  if (typeof src === "string") setModalImageSrc(src);
                                }}
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>

                        {/* Checkpoint question — shown as a highlighted box */}
                        {msg.checkpoint && (
                          <div className="vw-checkpoint">
                            <div className="vw-checkpoint-label">
                              <Target size={11}/>Comprehension Check
                            </div>
                            {msg.checkpoint}
                          </div>
                        )}
                      </div>

                      {/* Grade result banner below the bubble */}
                      {msg.gradeResult !== undefined && msg.gradeResult !== null && (
                        <CheckpointBanner correct={msg.gradeResult.correct}/>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isSpeaking && (
              <div className="vw-speaking">
                <Volume2 size={13}/> Viswasimi is speaking…
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="vw-bar">
            {error && (
              <div className="vw-err">
                <AlertCircle size={16}/><span>{error}</span>
              </div>
            )}

            {/* Show the checkpoint question as a prompt while awaiting an answer */}
            {pendingCheckpoint && canChat && (
              <div className="vw-cp-prompt">
                <div className="label"><Target size={10}/> Answer the question above to continue</div>
                {pendingCheckpoint}
              </div>
            )}

            <div className="vw-input-row">
              <button
                onClick={handleMicClick}
                className={`vw-mic ${isListening ? "listening" : ""}`}
                disabled={!canChat || loading}
                title="Dictate"
              >
                {isListening ? <Mic size={18} color="white"/> : <Mic size={18}/>}
              </button>

              <div className="vw-input-wrap">
                <input
                  className="vw-input"
                  style={{ paddingLeft: !canChat ? "40px" : "14px" }}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (prompt.trim() && canChat && !loading) {
                        void streamChatRequest(prompt.trim());
                      }
                    }
                  }}
                  placeholder={
                    !selectedTopic      ? "Select a topic first…"
                    : !canChat          ? "Click 'Start Session' to begin…"
                    : isListening       ? "Listening…"
                    : loading           ? "Viswasimi is typing…"
                    : pendingCheckpoint ? "Type your answer here…"
                    : "Ask a question…"
                  }
                  disabled={loading || !canChat || isListening}
                />
                {!canChat && <Lock size={16} className="vw-input-icon"/>}
              </div>

              <button
                className={`vw-send ${loading || !prompt.trim() || !canChat ? "off" : "on"}`}
                onClick={() => void streamChatRequest(prompt.trim())}
                disabled={loading || !prompt.trim() || !canChat}
              >
                {loading ? "Sending…" : <><Send size={14}/>Send</>}
              </button>
            </div>

            <p className="vw-hint">
              {!selectedTopic
                ? "Select a topic from the sidebar to start learning."
                : !canChat
                ? "⚠️ Start the session above before chatting."
                : tutorMode === "guided" && pendingCheckpoint
                ? "📝 Answer the checkpoint question — your score will be recorded automatically."
                : tutorMode === "guided"
                ? `📖 Section ${currentChunkIndex + 1} — click "Next Page" after answering to continue.`
                : "Ask any question · AI may occasionally make mistakes"}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "4rem", textAlign: "center", color: "#64748b", fontFamily: "sans-serif" }}>
        Loading…
      </div>
    }>
      <ChatContent/>
    </Suspense>
  );
}
