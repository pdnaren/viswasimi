import type { Chapter, Subject } from "./types";

export const getChapterStatus = (c: Chapter) => {
  if (!c.topics.length) return "available";
  if (c.topics.every(t => t.state === "done")) return "done";
  if (c.topics.some(t => t.state === "done" || t.state === "in_progress")) return "in_progress";
  if (c.topics.every(t => t.state === "locked")) return "locked";
  return "available";
};

export const getSubjectStatus = (s: Subject) => {
  if (!s.chapters.length) return "available";
  const st = s.chapters.map(getChapterStatus);
  if (st.every(x => x === "done")) return "done";
  if (st.some(x => x === "done" || x === "in_progress")) return "in_progress";
  return "available";
};

export const STATUS_EMOJI: Record<string, string> = {
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
export function extractCheckpoint(raw: string): { cleanContent: string; checkpoint: string | null } {
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
export function normaliseMath(text: string): string {
  return text
    .replace(/\\\[/g, "\n$$\n")
    .replace(/\\\]/g, "\n$$\n")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");
}
