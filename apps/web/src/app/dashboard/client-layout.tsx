"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { getApiUrl } from "@/app/lib/api";
import { clearSessionToken, getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/app/components/brand-logo";
import { NotificationBell } from "@/app/components/NotificationBell";

export const C = {
  bg: "#f4f6fb",
  surface: "#ffffff",
  card: "#ffffff",
  cardHover: "#f0f3fa",
  border: "rgba(0,0,0,0.08)",
  borderHover: "rgba(0,0,0,0.15)",
  primary: "#4f7cff",
  secondary: "#00b896",
  amber: "#f59e0b",
  pink: "#f43f8e",
  red: "#ef4444",
  text: "#111827",
  muted: "#6b7280",
  glow: "rgba(79,124,255,0.15)",
} as const;

const NAV = [
  { href: "/dashboard",            icon: "⬡", label: "Dashboard"  },
  { href: "/dashboard/search",     icon: "⌕", label: "Search"     },
  { href: "/dashboard/chat",       icon: "✦", label: "AI Tutor"   },
  { href: "/dashboard/curriculum", icon: "▦", label: "Curriculum" },
  { href: "/dashboard/assessments", icon: "◆", label: "Quizzes"    },
  { href: "/dashboard/study-plan", icon: "◷", label: "Study Plan" },
  { href: "/dashboard/progress",   icon: "◎", label: "Progress"   },
  { href: "/dashboard/profile",    icon: "◈", label: "Profile"    },
];

/* ── Top Progress Bar ──────────────────────────────────────────────────── */
function TopProgressBar({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      setWidth(0);
      setTimeout(() => setWidth(30), 20);
      intervalRef.current = setInterval(() => {
        setWidth(w => {
          if (w >= 85) { clearInterval(intervalRef.current!); return w; }
          return w + (85 - w) * 0.06;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setWidth(100);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearTimeout(timerRef.current!);
    };
  }, [loading]);

  if (!visible) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, height: 3, pointerEvents: "none" }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
        transition: width === 100 ? "width 0.2s ease" : "width 0.4s ease",
        boxShadow: `0 0 10px ${C.primary}88`,
        borderRadius: "0 99px 99px 0",
        opacity: width === 100 ? 0 : 1,
      }} />
    </div>
  );
}

/* ── Nav Item with ripple ──────────────────────────────────────────────── */
function NavItem({
  href, icon, label, active, collapsed, onClick
}: {
  href: string; icon: string; label: string;
  active: boolean; collapsed: boolean; onClick: () => void;
}) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const ref = useRef<HTMLAnchorElement>(null);

  function handleClick(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples(r => [...r, { id, x, y }]);
      setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
    }
    onClick();
  }

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={`nav-item${active ? " active" : ""}`}
      style={{
        justifyContent: collapsed ? "center" : "flex-start",
        position: "relative",
        overflow: "hidden",
      }}
      title={collapsed ? label : undefined}
    >
      {ripples.map(rp => (
        <span
          key={rp.id}
          style={{
            position: "absolute",
            left: rp.x,
            top: rp.y,
            width: 6,
            height: 6,
            marginLeft: -3,
            marginTop: -3,
            borderRadius: "50%",
            background: active ? `${C.primary}55` : "rgba(79,124,255,0.25)",
            transform: "scale(0)",
            animation: "ripple 0.55s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      ))}
      <span className="icon">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

/* ── Layout ────────────────────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const prevPath = useRef(path);

  useEffect(() => {
    if (path !== prevPath.current) {
      setNavigating(false);
      setMobileOpen(false);
      prevPath.current = path;
    }
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    const fetchUserData = async () => {
      try {
        const res = await fetch(getApiUrl("/api/profile/me"), { 
          headers: { ...getAuthHeaders() } 
        });
        if (cancelled) return;
        
        if (res.ok) {
          const payload = await parseJsonResponse<any>(res);
          setUser(payload); 
          const role = payload.role || payload.user?.role;
          if (role && role.toUpperCase() === "ADMIN") {
            setIsAdmin(true);
          }
        }
      } catch (err) {}
    };
    fetchUserData();
    return () => { cancelled = true; };
  }, []);

  const handleNavClick = useCallback(() => {
    setNavigating(true);
  }, []);

  const handleLogout = useCallback(async () => {
    setNavigating(true);
    try {
      await fetch(getApiUrl("/api/auth/logout"), {
        method: "GET",
        headers: { ...getAuthHeaders() },
      });
    } finally {
      clearSessionToken();
      router.push("/login");
      router.refresh();
      setNavigating(false);
    }
  }, [router]);

  const planName = user?.subscription?.planName || "Free";
  const isFree = planName.toLowerCase() === "free";

  return (
    <div className="dashboard-root" style={{
      display: "flex", minHeight: "100vh", background: C.bg,
      fontFamily: "'Sora','Segoe UI',sans-serif", color: C.text,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }

        @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ripple    { 0%{transform:scale(0);opacity:0.6} 100%{transform:scale(18);opacity:0} }

        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 10px;
          text-decoration: none; color: ${C.muted};
          font-size: 13px; font-weight: 500;
          transition: background 0.18s, color 0.18s, transform 0.12s;
          cursor: pointer; border: none; background: none; width: 100%;
          position: relative; overflow: hidden;
        }
        .nav-item:hover { background: rgba(79,124,255,0.07); color: ${C.text}; }
        .nav-item:active { transform: scale(0.97); }
        .nav-item.active { background: rgba(79,124,255,0.10); color: ${C.primary}; font-weight: 600; }
        .nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
          width: 3px; border-radius: 0 3px 3px 0; background: ${C.primary};
        }
        .nav-item .icon { font-size: 16px; flex-shrink: 0; width: 20px; text-align: center; }
        .collapse-btn {
          background: none; border: none; cursor: pointer; color: ${C.muted};
          padding: 6px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center;
        }
        .collapse-btn:hover { background: rgba(0,0,0,0.05); color: ${C.text}; }
        .page-content { transition: opacity 0.15s ease; }
        .page-content.navigating { opacity: 0.5; pointer-events: none; }

        .mobile-topbar { display: none; }
        .sidebar-backdrop { display: none; }
        .mobile-menu-btn {
          background: none; border: none; cursor: pointer; color: ${C.text};
          padding: 6px; border-radius: 8px; display: flex; align-items: center;
        }
        .mobile-menu-btn:hover { background: rgba(0,0,0,0.05); }

        @media (max-width: 860px) {
          .dashboard-root { flex-direction: column; }
          .dashboard-sidebar {
            position: fixed !important;
            top: 0; left: 0; height: 100dvh;
            width: 260px !important;
            min-width: 260px !important;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            z-index: 1000;
          }
          .dashboard-sidebar.mobile-open { transform: translateX(0); }
          .mobile-topbar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px; background: ${C.surface}; border-bottom: 1px solid ${C.border};
            position: sticky; top: 0; z-index: 500;
          }
          .sidebar-backdrop.open {
            display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 900;
          }
        }
      `}</style>

      <TopProgressBar loading={navigating} />

      {/* Mobile-only top bar with hamburger — hidden on desktop via CSS */}
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" style={{ textDecoration: "none", color: C.text }}>
          <BrandLogo size={26} textSize={15} />
        </Link>
        <NotificationBell />
      </div>

      <div
        className={`sidebar-backdrop${mobileOpen ? " open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`dashboard-sidebar${mobileOpen ? " mobile-open" : ""}`} style={{
        width: collapsed ? 60 : 220,
        flexShrink: 0,
        background: C.surface,
        borderRight: `1px solid ${C.border}`,
        boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
        display: "flex", flexDirection: "column",
        padding: "20px 10px",
        transition: "width 0.25s ease",
        position: "sticky", top: 0, height: "100vh",
        overflowY: "auto", overflowX: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: "0 4px", marginBottom: 28 }}>
          {!collapsed && <Link href="/" style={{ textDecoration: "none", color: C.text }}><BrandLogo size={28} textSize={16} /></Link>}
          {collapsed && <BrandLogo size={26} showText={false} />}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {!collapsed && <NotificationBell />}
            <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d={collapsed ? "M5 2l5 5-5 5" : "M9 2L4 7l5 5"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map(n => (
            <NavItem key={n.href} href={n.href} icon={n.icon} label={n.label} active={path === n.href || (path?.startsWith(n.href + "/") ?? false)} collapsed={collapsed} onClick={handleNavClick} />
          ))}
          {isAdmin && (
            <NavItem href="/dashboard/admin" icon="⚙" label="Admin Panel" active={path?.startsWith("/dashboard/admin") ?? false} collapsed={collapsed} onClick={handleNavClick} />
          )}
        </nav>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {!collapsed && (
            <div style={{ background: "rgba(79,124,255,0.06)", border: `1px solid rgba(79,124,255,0.18)`, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.primary, marginBottom: 3 }}>
                {planName} Plan
              </div>
              {isFree && <div style={{ fontSize: 11, color: C.muted }}>10 messages/day</div>}
              <Link href="/dashboard/upgrade" style={{ display: "block", marginTop: 6, fontSize: 11, fontWeight: 700, color: C.primary, textDecoration: "none" }}>
                {planName.toLowerCase() === "basic" ? "Upgrade → Premium ✨" : planName.toLowerCase() === "premium" ? "Active Benefits" : "Upgrade → Basic"}
              </Link>
            </div>
          )}
          <button type="button" onClick={handleLogout} className="nav-item" style={{ justifyContent: collapsed ? "center" : "flex-start", color: C.red }}>
            <span className="icon">⊗</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className={`page-content${navigating ? " navigating" : ""}`} style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}