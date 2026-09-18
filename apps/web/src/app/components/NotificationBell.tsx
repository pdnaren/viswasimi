"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { C } from "@/app/lib/theme";

type Notification = { type: string; title: string; body: string; topicId: string | null; priority: number };

const ICONS: Record<string, string> = {
  REVISION_DUE: "🔁",
  LESSON_INCOMPLETE: "⏰",
  DAILY_LESSON_READY: "✨",
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/notifications"), { headers: { ...getAuthHeaders() } });
        const data = await parseJsonResponse<{ notifications: Notification[] }>(res);
        if (!cancelled) setNotifications(data.notifications || []);
      } catch {
        // Non-critical panel — fail silently, bell just shows no badge.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={notifications.length > 0 ? `Notifications (${notifications.length} new)` : "Notifications"}
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: C.muted, display: "flex", alignItems: "center" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2a5 5 0 00-5 5v2.5c0 .7-.28 1.37-.78 1.87L3 12.6c-.5.5-.15 1.4.56 1.4h12.88c.71 0 1.06-.9.56-1.4l-1.22-1.23A2.64 2.64 0 0115 9.5V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M7.5 16a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {notifications.length > 0 && (
          <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: C.red, border: `1.5px solid ${C.surface}` }} />
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, maxHeight: 360, overflowY: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.14)", zIndex: 50 }}>
          <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: C.text, borderBottom: `1px solid ${C.border}` }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: C.muted, textAlign: "center" }}>You&apos;re all caught up!</div>
          ) : (
            notifications.map((n, i) => {
              const row = (
                <div style={{ padding: "12px 16px", borderBottom: i < notifications.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                    {ICONS[n.type] || "🔔"} {n.title}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{n.body}</div>
                </div>
              );
              return n.topicId ? (
                <Link key={`${n.type}-${i}`} href={`/dashboard/chat?topicId=${n.topicId}`} onClick={() => setOpen(false)} style={{ textDecoration: "none", display: "block" }}>
                  {row}
                </Link>
              ) : (
                <div key={`${n.type}-${i}`}>{row}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
