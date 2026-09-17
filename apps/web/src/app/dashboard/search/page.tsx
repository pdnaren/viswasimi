"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";

type SearchResult = {
  id: string; name: string; state: string; mastery: number;
  subjectId: string; subjectName: string; chapterId: string; chapterName: string;
};

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  done:        { label: "Mastered", color: "#059669", bg: "#ecfdf5" },
  in_progress: { label: "Learning", color: "#2563eb", bg: "#eff6ff" },
  available:   { label: "Ready",    color: "#6366f1", bg: "#f5f3ff" },
  locked:      { label: "Locked",   color: "#94a3b8", bg: "#f8fafc" },
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || !q.trim()) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(getApiUrl(`/api/curriculum/search?q=${encodeURIComponent(q)}`), { headers: { ...getAuthHeaders() } });
        const data = await parseJsonResponse<{ results: SearchResult[] }>(res);
        if (!cancelled) setResults(data.results || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) { setLoading(false); setSearched(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/dashboard/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#f8fafc", minHeight: "100vh", padding: 40 }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#0f172a", marginBottom: 8 }}>Search</h1>
        <p style={{ color: "#64748b", fontSize: 15 }}>Find a topic across your curriculum by concept or name.</p>
      </header>

      <form onSubmit={handleSubmit} style={{ marginBottom: 28, maxWidth: 480 }}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Newton's Laws, Motion, Trigonometry…"
          style={{ width: "100%", padding: "14px 18px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 15, outline: "none", background: "#fff" }}
        />
      </form>

      {loading && <p style={{ color: "#94a3b8" }}>Searching…</p>}

      {!loading && searched && results.length === 0 && (
        <p style={{ color: "#94a3b8" }}>No topics matched &ldquo;{searchParams.get("q")}&rdquo;. Try a different word.</p>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          {results.map(r => {
            const meta = STATE_META[r.state] ?? STATE_META.locked;
            return (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{r.subjectName} · {r.chapterName}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{r.name}</div>
                  <span style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: meta.bg, color: meta.color }}>
                    {meta.label} · {r.mastery}/5
                  </span>
                </div>
                {r.state !== "locked" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/dashboard/chat?topicId=${r.id}`} style={{ padding: "8px 16px", borderRadius: 8, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      Learn
                    </Link>
                    <Link href={`/dashboard/assessments?topicId=${r.id}&label=${encodeURIComponent(r.name)}`} style={{ padding: "8px 16px", borderRadius: 8, background: "#f1f5f9", color: "#334155", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      Quiz
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fafc" }} />}>
      <SearchContent />
    </Suspense>
  );
}
