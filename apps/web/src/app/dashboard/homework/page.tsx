"use client";

import React, { useState } from "react";
import { getApiUrl } from "@/app/lib/api";
import { getApiErrorMessage, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import MarkdownRenderer from "@/app/components/MarkdownRenderer";

type AssistanceLevel = "hint" | "steps" | "solution";

const LEVELS: { value: AssistanceLevel; label: string; description: string }[] = [
  { value: "hint", label: "Just a hint", description: "Nudge me in the right direction" },
  { value: "steps", label: "Walk me through it", description: "Step-by-step guidance" },
  { value: "solution", label: "Full solution", description: "Show the complete answer" },
];

export default function HomeworkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<AssistanceLevel>("hint");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setAnswer(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Please upload a photo or screenshot of the question first."); return; }
    setError(null);
    setAnswer(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("assistanceLevel", level);
      if (question.trim()) formData.append("question", question.trim());

      const res = await fetch(getApiUrl("/api/chat/homework"), {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: formData,
      });
      const data = await parseJsonResponse<{ answer?: string; detail?: string }>(res);
      if (!res.ok) { setError(getApiErrorMessage(data, "Could not process your homework photo.")); return; }
      setAnswer(data.answer || "");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 40 }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#0f172a", marginBottom: 8 }}>Homework Help</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Upload a photo of a question you&apos;re stuck on, and choose how much help you want.</p>
      </header>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, flex: "1 1 360px", maxWidth: 460 }}>
          <label
            htmlFor="homework-upload"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed #cbd5e1", borderRadius: 14, padding: preview ? 12 : 36,
              cursor: "pointer", marginBottom: 18, background: "#f8fafc", textAlign: "center",
            }}
          >
            <input id="homework-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Homework question preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10 }} />
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Click to upload a photo</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>PNG, JPEG, or WEBP</div>
              </>
            )}
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 6 }}>
            Anything specific to add? (optional)
          </label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. I don't understand part (b)"
            rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", marginBottom: 18, resize: "vertical" }}
          />

          <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 8 }}>
            How much help do you want?
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {LEVELS.map(l => (
              <button
                type="button"
                key={l.value}
                onClick={() => setLevel(l.value)}
                style={{
                  textAlign: "left", padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${level === l.value ? "#6366f1" : "#e2e8f0"}`,
                  background: level === l.value ? "#eef2ff" : "#fff",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{l.label}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{l.description}</div>
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file}
            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: "#6366f1", color: "#fff", fontWeight: 700, fontSize: 14, cursor: loading || !file ? "not-allowed" : "pointer", opacity: loading || !file ? 0.6 : 1 }}
          >
            {loading ? "Reading your question…" : "Get Help →"}
          </button>
        </form>

        {(loading || answer) && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, flex: "2 1 420px", minHeight: 200 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
              {loading ? "Thinking…" : "Here's some help"}
            </h2>
            {loading ? (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>Analyzing your question…</p>
            ) : (
              <div style={{ fontSize: 14, color: "#334155", lineHeight: 1.7 }}>
                <MarkdownRenderer content={answer || ""} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
