"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./components/brand-logo";
import { Button as Btn, BUTTON_STYLES } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Badge, SectionLabel } from "@/app/components/ui/Badge";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { C, EASE, GLASS } from "@/app/lib/theme";
import { getApiUrl } from "@/app/lib/api";
import { clearSessionToken, getAuthHeaders, getSessionToken } from "@/app/lib/auth-client";

// ── ANIMATED SECTIONS ──────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTimeout(() => setVis(true), delay); obs.unobserve(el); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(22px)", transition: `opacity 0.7s ${EASE}, transform 0.7s ${EASE}` }}>
      {children}
    </div>
  );
}

// ── CANVAS PARTICLES ───────────────────────────────────────────
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    window.addEventListener("resize", () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });
    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 1.5,
      vx: -0.15 + Math.random() * 0.3,
      vy: -0.2 + Math.random() * -0.05,
      a: 0.08 + Math.random() * 0.2,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79,124,255,${p.a})`; ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.5 }} />;
}

// ── FAQ ITEM ──────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = React.useId();
  return (
    <div
      style={{
        ...GLASS,
        border: `1px solid ${open ? "rgba(79,124,255,0.3)" : "rgba(255,255,255,0.6)"}`,
        borderRadius: 12,
        transition: `all 0.25s ${EASE}`,
        boxShadow: open ? "0 4px 20px rgba(79,124,255,0.10), inset 0 1px 0 rgba(255,255,255,0.6)" : GLASS.boxShadow,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          width: "100%", background: "transparent", border: "none", padding: "18px 22px",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: C.text }}>{q}</span>
        <span aria-hidden="true" style={{ color: C.primary, fontSize: 20, lineHeight: 1, flexShrink: 0, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && <p id={panelId} style={{ margin: "0 22px 18px", color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{a}</p>}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    void (async () => { setLoggedIn(!!getSessionToken()); })();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(getApiUrl("/api/auth/logout"), { method: "GET", headers: { ...getAuthHeaders() } });
    } finally {
      clearSessionToken();
      setLoggedIn(false);
      setLoggingOut(false);
      setMobileMenuOpen(false);
      router.refresh();
    }
  }

  return (
    <div style={{ fontFamily: "'Sora', 'Segoe UI', sans-serif", background: C.bg, color: C.text, overflowX: "hidden", lineHeight: 1.6 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }
        a { color: inherit; text-decoration: none; }
        ul { list-style: none; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes drift { from{transform:translate(0,0) scale(1)} to{transform:translate(40px,30px) scale(1.08)} }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .msg { animation: msgIn 0.5s ease both; }
        .msg:nth-child(1) { animation-delay: 0.8s }
        .msg:nth-child(2) { animation-delay: 1.3s }
        .msg:nth-child(3) { animation-delay: 1.9s }
        .msg:nth-child(4) { animation-delay: 2.5s }
        .nav-link { color: ${C.muted}; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-link:hover { color: ${C.text}; }
        .nav-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 6px; border-radius: 8px; }
        .nav-mobile-toggle:hover { background: rgba(0,0,0,0.05); }
        .nav-mobile-panel { display: none; }
        @media (max-width: 760px) {
          .nav-links-desktop, .nav-actions-desktop { display: none !important; }
          .nav-mobile-toggle { display: flex; align-items: center; }
          .nav-mobile-panel {
            display: flex; flex-direction: column; gap: 4px;
            position: fixed; top: 60px; left: 16px; right: 16px; z-index: 99;
            background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px;
            padding: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          }
        }
        .nav-mobile-link { color: ${C.text}; font-size: 15px; font-weight: 600; padding: 10px 8px; border-radius: 8px; }
        .nav-mobile-link:hover { background: rgba(79,124,255,0.06); }
        @media (max-width: 640px) {
          .usp-grid { grid-template-columns: repeat(2,1fr) !important; row-gap: 20px; }
          .usp-grid > div:nth-child(even) { border-right: none !important; }
        }
        .feat-card:hover .feat-icon { transform: scale(1.1); }
        .feat-card:hover { transform: translateY(-4px); border-color: rgba(79,124,255,0.3); box-shadow: 0 16px 40px rgba(16,24,40,0.10), inset 0 1px 0 rgba(255,255,255,0.6); }
        ${BUTTON_STYLES}
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
      `}</style>

      <Particles />

      {/* AMBIENT ORBS */}
      {[
        { w: 500, h: 500, bg: C.primary, top: -100, left: -100, delay: 0 },
        { w: 400, h: 400, bg: C.secondary, bottom: 0, right: -100, delay: -8 },
        { w: 300, h: 300, bg: C.pink, top: "40%", left: "50%", delay: -14 },
      ].map((o, i) => (
        <div key={i} aria-hidden="true" style={{
          position: "fixed", borderRadius: "50%", filter: "blur(100px)", opacity: 0.12,
          pointerEvents: "none", zIndex: 0, width: o.w, height: o.h, background: o.bg,
          top: (o as any).top, left: (o as any).left, bottom: (o as any).bottom, right: (o as any).right,
          animation: `drift 20s ease-in-out ${o.delay}s infinite alternate`,
        }} />
      ))}

      {/* ── NAV ── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: scrolled ? "var(--header-bg-scroll)" : "var(--header-bg-top)",
        borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`,
        transition: `all 0.3s ${EASE}`,
        boxShadow: scrolled ? "0 1px 12px rgba(0,0,0,0.06)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <BrandLogo size={30} textSize={18} />
        </div>

        <nav aria-label="Primary" className="nav-links-desktop" style={{ display: "flex", gap: 28 }}>
          {["features", "plans", "roadmap", "faq"].map(l => (
            <a key={l} href={`#${l}`} className="nav-link" style={{ textTransform: "capitalize" }}>{l}</a>
          ))}
        </nav>

        <div className="nav-actions-desktop" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <ThemeToggle />
          {loggedIn ? (
            <Btn variant="ghost" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Logging out…" : "Logout"}
            </Btn>
          ) : (
            <>
              <Btn href="/login" variant="ghost">Login</Btn>
              <Btn href="/signup" variant="primary">Start Free →</Btn>
            </>
          )}
        </div>

        <button
          type="button"
          className="nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(o => !o)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {mobileMenuOpen ? (
              <path d="M5 5l12 12M17 5L5 17" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M3 6h16M3 11h16M3 16h16" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <div className="nav-mobile-panel" role="dialog" aria-modal="true" aria-label="Menu">
          {["features", "plans", "roadmap", "faq"].map(l => (
            <a key={l} href={`#${l}`} className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)} style={{ textTransform: "capitalize" }}>{l}</a>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0 8px" }}>
            <ThemeToggle />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loggedIn ? (
              <Btn variant="ghost" onClick={handleLogout} disabled={loggingOut} block>
                {loggingOut ? "Logging out…" : "Logout"}
              </Btn>
            ) : (
              <>
                <Btn href="/login" variant="ghost" block>Login</Btn>
                <Btn href="/signup" variant="primary" block>Start Free →</Btn>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", position: "relative", zIndex: 1 }}>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(79,124,255,0.08)", border: "1px solid rgba(79,124,255,0.25)", color: C.primary, padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 28, animation: "msgIn 0.6s ease both" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, animation: "pulse 1.5s ease-in-out infinite" }} />
          NOW IN EARLY ACCESS — CLASSES 6–12 + JEE / NEET
        </div>

        <h1 style={{ fontSize: "clamp(2.6rem, 6.5vw, 5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.06, maxWidth: 780, color: C.text, animation: "msgIn 0.6s 0.1s ease both", animationFillMode: "both" }}>
          Your Personal AI Tutor<br />
          for Classes 6–12 &amp;{" "}
          <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontWeight: 400, background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Competitive Exams
          </span>
        </h1>

        <p style={{ marginTop: 22, fontSize: "clamp(1rem,2vw,1.18rem)", color: C.muted, maxWidth: 540, lineHeight: 1.75, fontWeight: 400, animation: "msgIn 0.6s 0.2s ease both", animationFillMode: "both" }}>
          Learn smarter with Viswasimi — personalized AI chat tutoring, structured assessments, and deep analytics for school and exam prep.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap", justifyContent: "center", animation: "msgIn 0.6s 0.3s ease both", animationFillMode: "both" }}>
          <Btn href="/signup" variant="primary" size="lg">Start Learning Free →</Btn>
          <Btn href="#plans" variant="outline" size="lg">Explore Basic Plan</Btn>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 40, marginTop: 52, flexWrap: "wrap", justifyContent: "center", animation: "msgIn 0.6s 0.4s ease both", animationFillMode: "both" }}>
          {[["6–12", "Class Coverage"], ["JEE + NEET", "Competitive Exams"], ["₹0", "To Get Started"], ["4 Modes", "AI Tutoring"]].map(([n, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>{n}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Chat mockup */}
        <div style={{ marginTop: 56, width: "100%", maxWidth: 660, animation: "msgIn 0.8s 0.6s ease both", animationFillMode: "both" }}>
          <div style={{
            ...GLASS,
            border: "1px solid rgba(255,255,255,0.6)",
            borderRadius: 20, overflow: "hidden",
            boxShadow: "0 8px 40px rgba(79,124,255,0.14), 0 1px 2px rgba(16,24,40,0.06), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}>
            {/* Window bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: "rgba(249,250,251,0.6)" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["#ff5f57","#ffbd2e","#28ca41"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${C.primary},${C.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>V</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Viswasimi AI Tutor</div>
                  <div style={{ fontSize: 11, color: C.secondary }}>● Online · Physics · Class 11</div>
                </div>
              </div>
            </div>
            {/* Messages */}
            <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14, background: "#fafbff" }}>
              {[
                { user: true, text: "Explain Newton's second law simply." },
                { user: false, text: <>Of course! Newton&apos;s 2nd Law: <code style={{ background: `${C.amber}18`, color: C.amber, padding: "2px 8px", borderRadius: 5, fontFamily: "monospace" }}>F = m × a</code> — the force on an object equals its mass times acceleration. Push a bicycle vs. a bus with the same force — the bicycle moves faster. Same force, less mass = more acceleration!</> },
                { user: true, text: "Give me a practice problem." },
                { user: false, text: "A 5 kg block accelerates at 3 m/s². What is the net force? Try it — I'll explain every step! 🎯" },
              ].map((m, i) => (
                <div key={i} className="msg" style={{ display: "flex", justifyContent: m.user ? "flex-end" : "flex-start", gap: 8 }}>
                  {!m.user && <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${C.primary},${C.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 2 }}>V</div>}
                  <div style={{
                    maxWidth: "78%", padding: "10px 14px", fontSize: 14, lineHeight: 1.65,
                    borderRadius: m.user ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    background: m.user ? C.primary : "rgba(79,124,255,0.07)",
                    border: m.user ? "none" : "1px solid rgba(79,124,255,0.15)",
                    color: m.user ? "#fff" : C.text,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── USP BAND ── */}
      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div className="usp-grid" style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", padding: "28px 24px" }}>
          {[
            ["🧠", "AI-Powered Tutoring", "Instant explanations and doubt-solving."],
            ["🏫", "Classes 6–12", "Aligned with CBSE, ICSE & State Boards."],
            ["📝", "Smart Assessments", "Topic, chapter & subject-level tests."],
            ["📊", "Personalized Analytics", "Weakness detection and progress insights."],
          ].map(([icon, title, desc]) => (
            <div key={title as string} style={{ textAlign: "center", padding: "0 16px", borderRight: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: C.text }}>{title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "90px 24px", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <SectionLabel>Why Viswasimi</SectionLabel>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, maxWidth: 520, marginBottom: 12, color: C.text }}>
            Every student learns differently.{" "}
            <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, color: C.secondary }}>AI that adapts to you.</span>
          </h2>
          <p style={{ color: C.muted, fontSize: 16, maxWidth: 500, lineHeight: 1.7 }}>
            Viswasimi combines AI tutoring, structured assessments, and deep analytics to help students understand faster and score higher.
          </p>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginTop: 42 }}>
          {[
            { icon: "🧠", color: C.primary, title: "Personalized AI Tutor", desc: "Topic-wise explanations, examples and revision summaries tailored to each student's pace and level." },
            { icon: "📊", color: C.secondary, title: "Weakness Analytics", desc: "Identify weak areas instantly. Get targeted recommendations — your weaknesses become your strengths." },
            { icon: "📝", color: C.amber, title: "Structured Assessments", desc: "Auto-generated topic, chapter, and subject tests. Each attempt gets smarter based on your performance." },
            { icon: "🗣️", color: C.pink, title: "Voice Tutor (Phase 3)", desc: "Speak your question, hear a clear AI explanation. Perfect for students who learn through listening." },
            { icon: "🎬", color: "#a050ff", title: "AI Video Tutor (Phase 4)", desc: "Animated avatar and whiteboard-style explanations for complex concepts — like having a teacher draw it out for you." },
            { icon: "🏆", color: C.secondary, title: "Exam-Focused Prep", desc: "JEE, NEET, State Boards, Olympiads — curated content mapped to real syllabus patterns." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="feat-card" style={{ ...GLASS, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, padding: "26px 22px", transition: `all 0.3s ${EASE}`, height: "100%" }}>
                <div className="feat-icon" style={{ width: 46, height: 46, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: `${f.color}14`, marginBottom: 14, transition: "transform 0.2s" }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em", color: C.text }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FEATURE DEEP-DIVE ROWS ── */}
      <section style={{ padding: "0 24px 90px", maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {[
          { title: "AI Chat Tutor", desc: "Get instant step-by-step explanations, examples and clarifications across all subjects and topics. Available 24/7, endlessly patient.", icon: "💬", color: C.primary, reverse: false },
          { title: "Assessments & Tests", desc: "Practice with topic, chapter and subject-level assessments. Track performance over time and watch your confidence grow.", icon: "📋", color: C.secondary, reverse: true },
          { title: "Analytics & Insights", desc: "Understand strengths and weaknesses with detailed analytics. Get personalized improvement suggestions after every test.", icon: "📈", color: C.amber, reverse: false },
        ].map((r, i) => (
          <Reveal key={r.title} delay={i * 100}>
            <div style={{ display: "flex", flexDirection: r.reverse ? "row-reverse" : "row", gap: 40, alignItems: "center", marginBottom: 64, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: r.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Feature</div>
                <h3 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 14, color: C.text }}>{r.title}</h3>
                <p style={{ color: C.muted, lineHeight: 1.75, fontSize: 15 }}>{r.desc}</p>
              </div>
              <div style={{ ...GLASS, flex: 1, minWidth: 260, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 40 }}>{r.icon}</div>
                <div style={{ fontSize: 13, color: C.muted }}>Interactive demo coming soon</div>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── PLANS ── */}
      <section id="plans" style={{ padding: "90px 24px", position: "relative", zIndex: 1, background: C.surface }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <SectionLabel>Pricing</SectionLabel>
              <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>
                Start free.{" "}
                <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, color: C.secondary }}>Grow as you learn.</span>
              </h2>
              <p style={{ color: C.muted, marginTop: 10, fontSize: 15 }}>No credit card required to get started.</p>
            </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
            {/* FREE */}
            <Reveal delay={0}>
              <Card style={{ height: "100%" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.muted, marginBottom: 14, textTransform: "uppercase" }}>Free</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.text }}>₹0</div>
                <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 20px", lineHeight: 1.6 }}>Try AI tutoring before committing anything.</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                  {["Topic #1 of each subject", "10 AI chat messages/day", "Dashboard access"].map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: C.text }}><span style={{ color: C.secondary, flexShrink: 0 }}>✓</span>{f}</li>
                  ))}
                  {["Full curriculum", "Assessments"].map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: C.muted }}><span style={{ flexShrink: 0 }}>—</span>{f}</li>
                  ))}
                </ul>
                <Btn href="/signup" variant="ghost" block>Get started →</Btn>
              </Card>
            </Reveal>

            {/* BASIC */}
            <Reveal delay={80}>
              <Card featured style={{ height: "100%" }}>
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                  <Badge color={C.primary}>● LIVE NOW</Badge>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.primary, marginBottom: 14, textTransform: "uppercase" }}>Basic</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.text }}>₹299<span style={{ fontSize: 16, fontWeight: 400, color: C.muted }}>/mo</span></div>
                <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 20px", lineHeight: 1.6 }}>Everything you need for serious exam prep.</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                  {["Full curriculum unlocked", "Unlimited AI chat", "Topic + chapter tests", "Weakness analysis", "Progress tracking"].map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: C.text }}><span style={{ color: C.secondary, flexShrink: 0 }}>✓</span>{f}</li>
                  ))}
                </ul>
                <Btn href="/signup" variant="primary" block>Upgrade to Basic →</Btn>
              </Card>
            </Reveal>

            {/* STANDARD */}
            <Reveal delay={160}>
              <Card style={{ height: "100%", opacity: 0.7 }}>
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                  <Badge color={C.muted}>Phase 3</Badge>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.secondary, marginBottom: 14, textTransform: "uppercase" }}>Standard</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.muted }}>Soon</div>
                <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 20px", lineHeight: 1.6 }}>Everything in Basic, plus AI voice conversations.</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                  {["Everything in Basic", "Voice Tutor (AI TTS+STT)", "Speak questions out loud"].map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: C.muted }}><span style={{ color: C.secondary, flexShrink: 0 }}>✓</span>{f}</li>
                  ))}
                </ul>
                <Btn variant="disabled" block disabled>Available in Phase 3</Btn>
              </Card>
            </Reveal>

            {/* PREMIUM */}
            <Reveal delay={240}>
              <Card style={{ height: "100%", opacity: 0.7 }}>
                <div style={{ position: "absolute", top: 14, right: 14 }}>
                  <Badge color={C.muted}>Phase 4</Badge>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: C.amber, marginBottom: 14, textTransform: "uppercase" }}>Premium</div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.muted }}>Soon</div>
                <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 20px", lineHeight: 1.6 }}>The full experience — chat, voice and AI video.</p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 22 }}>
                  {["Everything in Standard", "AI Video Tutor", "Avatar/whiteboard teaching", "Real-time visualization"].map(f => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 13, color: C.muted }}><span style={{ color: C.amber, flexShrink: 0 }}>✓</span>{f}</li>
                  ))}
                </ul>
                <Btn variant="disabled" block disabled>Available in Phase 4</Btn>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "90px 24px", maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        <Reveal>
          <SectionLabel>Getting Started</SectionLabel>
          <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>
            How it <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, color: C.secondary }}>works</span>
          </h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginTop: 40 }}>
          {[
            ["01", "Sign Up Free", "Create your account on viswasimi.com in under 2 minutes. No card needed."],
            ["02", "Start Chatting", "Ask any question. Get instant, personalized explanations from your AI tutor."],
            ["03", "Take Assessments", "Test knowledge topic by topic. Viswasimi finds your gaps automatically."],
            ["04", "Upgrade Anytime", "Add voice and video tutoring as you grow. Learn the way that works for you."],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 80}>
              <div style={{ ...GLASS, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 14, background: `linear-gradient(135deg,${C.primary},rgba(79,124,255,0.3))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{n}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: C.text }}>{t}</h3>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="roadmap" style={{ padding: "90px 24px", position: "relative", zIndex: 1, background: C.surface }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <SectionLabel>Product Roadmap</SectionLabel>
              <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>
                Building the future of{" "}
                <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, color: C.primary }}>learning</span>
              </h2>
            </div>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
            {[
              { phase: "Phase 1", status: "NOW", color: C.secondary, items: ["Free + Basic plans", "AI chat tutor", "LMS foundation", "Payment integration", "Live on viswasimi.com"] },
              { phase: "Phase 2", status: "NEXT", color: C.primary, items: ["Classes 11–12 content", "JEE, NEET, Olympiads", "Document upload", "Vector DB (RAG)"] },
              { phase: "Phase 3", status: "FUTURE", color: C.amber, items: ["Voice Tutor (Standard)", "AI voice conversations", "Azure Speech API"] },
              { phase: "Phase 4", status: "FUTURE", color: C.pink, items: ["AI Video Tutor (Premium)", "Avatar engine", "Whiteboard animations"] },
            ].map((p, i) => (
              <Reveal key={p.phase} delay={i * 80}>
                <div style={{ ...GLASS, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, padding: "24px 20px", height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: C.text }}>{p.phase}</span>
                    <Badge color={p.color}>{p.status}</Badge>
                  </div>
                  <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {p.items.map(it => (
                      <li key={it} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                        <span style={{ color: p.color, flexShrink: 0 }}>→</span>
                        <span style={{ color: C.muted }}>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: "90px 24px", maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <SectionLabel>FAQ</SectionLabel>
            <h2 style={{ fontSize: "clamp(2rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>Frequently asked questions</h2>
          </div>
        </Reveal>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            ["Is Viswasimi free?", "Yes! You can start with the Free Plan and explore the first topic of each subject with up to 10 AI chat messages per day. No credit card needed."],
            ["Which classes are supported?", "Viswasimi covers Classes 6–12. Competitive exam content like JEE, NEET, and Olympiads will be added in Phase 2."],
            ["How does the AI tutor work?", "The AI tutor uses advanced language models (GPT-4.1-mini via Azure OpenAI) to explain concepts, solve doubts, and provide tailored responses based on your queries and learning history."],
            ["Can I upgrade later?", "Absolutely. Start on the Free Plan and upgrade to Basic anytime for full curriculum access, unlimited chat, assessments, and analytics."],
            ["When will voice and video tutors be available?", "Voice tutoring is planned for the Standard Plan (Phase 3). AI video tutoring with avatar-based explanations is planned for the Premium Plan (Phase 4)."],
          ].map(([q, a]) => (
            <Reveal key={q}>
              <FaqItem q={q} a={a} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA STRIP ── */}
      <section style={{ padding: "80px 24px", position: "relative", zIndex: 1 }}>
        <Reveal>
          <div style={{
            maxWidth: 800, margin: "0 auto",
            background: "linear-gradient(135deg, #eef2ff, #e8f4ff)",
            border: `1px solid rgba(79,124,255,0.2)`,
            borderRadius: 24, padding: "56px 40px", textAlign: "center",
            boxShadow: "0 8px 40px rgba(79,124,255,0.10)",
          }}>
            <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14, color: C.text }}>
              Ready to start your{" "}
              <span style={{ fontFamily: "'Instrument Serif',serif", fontStyle: "italic", fontWeight: 400, background: `linear-gradient(135deg,${C.primary},${C.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                AI learning journey?
              </span>
            </h2>
            <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 32px" }}>
              Join Viswasimi today and experience personalized AI-powered learning for Classes 6–12.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn href="/signup" variant="primary" size="lg">Start Free →</Btn>
              <Btn href="#plans" variant="outline" size="lg">Explore Basic Plan</Btn>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "48px 24px 28px", position: "relative", zIndex: 1, background: C.surface }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between", marginBottom: 36 }}>
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.03em", marginBottom: 10 }}>
              <span style={{ background: `linear-gradient(135deg,${C.primary},${C.secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Viswasimi</span>
            </div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>AI-powered learning platform for Classes 6–12 and competitive exams. Free to start, built to grow.</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: C.text }}>Quick Links</div>
            <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["features", "plans", "roadmap", "faq"].map(l => (
                <li key={l}><a href={`#${l}`} className="nav-link" style={{ fontSize: 13, textTransform: "capitalize" }}>{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: C.text }}>Contact</div>
            <p style={{ fontSize: 13, color: C.muted }}>contact@viswasimi.com</p>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>viswasimi.com</p>
          </div>
          {/* LEGAL LINKS */}

          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 12,
                color: C.text,
              }}
            >
              Legal
            </div>

            <ul
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <li>
                <Link href="/privacy-policy" className="nav-link">
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link href="/terms" className="nav-link">
                  Terms of Service
                </Link>
              </li>

              <li>
                <Link href="/refund-policy" className="nav-link">
                  Refund Policy
                </Link>
              </li>

              <li>
                <Link href="/cookies" className="nav-link">
                  Cookies Policy
                </Link>
              </li>

              <li>
                <Link href="/disclaimer" className="nav-link">
                  AI Disclaimer
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 22, textAlign: "center", fontSize: 12, color: C.muted }}>
          © {new Date().getFullYear()} Viswasimi Education Technologies. All rights reserved.
        </div>
      </footer>
    </div>
  );
} 
