"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import {
  Send, ChevronLeft, ChevronRight, PlayCircle, CheckCircle2,
  Lock, AlertCircle, ArrowRightCircle, Mic, Volume2, VolumeX,
  Target, Video,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm    from "remark-gfm";
import remarkMath   from "remark-math";
import rehypeKatex  from "rehype-katex";
import { useSpeech } from "@/app/hooks/useSpeech";

import type { Subject, PlanItem, Message } from "./types";
import { getChapterStatus, getSubjectStatus, STATUS_EMOJI, extractCheckpoint, normaliseMath } from "./chatHelpers";
import { PageImageModal } from "./components/PageImageModal";
import { VideoModal } from "./components/VideoModal";
import { CheckpointBanner } from "./components/CheckpointBanner";
import { CHAT_STYLES } from "./chatStyles";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Guided mode state
  const [tutorMode,          setTutorMode]          = useState<"qa"|"guided">("qa");
  const [currentChunkIndex,  setCurrentChunkIndex]  = useState(0);

  // Page image modal
  const [modalImageSrc,    setModalImageSrc]     = useState<string | null>(null);

  // Topic video modal
  const [showVideoModal,   setShowVideoModal]    = useState(false);

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

  // Close the mobile sidebar drawer once a topic is picked
  useEffect(() => {
    if (selectedTopicId) setMobileSidebarOpen(false);
  }, [selectedTopicId]);

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
    setShowVideoModal(false);
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

      {showVideoModal && selectedTopic?.videoUrl && (
        <VideoModal src={selectedTopic.videoUrl} onClose={() => setShowVideoModal(false)} />
      )}

      <style>{CHAT_STYLES}</style>

      <div className="vw-root">
        {/* Mobile-only backdrop behind the slide-in sidebar */}
        <div
          className={`vw-sidebar-backdrop${mobileSidebarOpen ? " open" : ""}`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
        <aside className={`vw-sb ${sidebarCollapsed ? "col" : "exp"}${mobileSidebarOpen ? " mobile-open" : ""}`}>
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
                    <div style={{ fontSize: 12, color: "var(--muted)", padding: "12px", background: "var(--card-hover)", borderRadius: 10, border: "1px dashed var(--border-hover)", textAlign: "center" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                className="vw-mobile-menu-btn"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open topics menu"
                aria-expanded={mobileSidebarOpen}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
              <div>
                <h2 className="vw-h-title">Chat with Tutor</h2>
                <p className="vw-h-sub">
                  {selectedTopic ? `📖 ${selectedTopic.name}` : "Select a topic to begin"}
                </p>
              </div>
            </div>
            <div className="vw-h-right">
              <button
                className={`vw-btn-voice ${voiceEnabled ? "on" : ""}`}
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopSpeaking(); }}
              >
                {voiceEnabled ? <Volume2 size={14}/> : <VolumeX size={14}/>}
                {voiceEnabled ? "Voice ON" : "Voice OFF"}
              </button>

              {selectedTopic?.videoUrl && (
                <button
                  className="vw-btn-voice"
                  onClick={() => setShowVideoModal(true)}
                  title="Watch the explainer video for this topic"
                >
                  <Video size={14}/> Watch Video
                </button>
              )}

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
      <div style={{ padding: "4rem", textAlign: "center", color: "var(--muted)", fontFamily: "sans-serif" }}>
        Loading…
      </div>
    }>
      <ChatContent/>
    </Suspense>
  );
}
