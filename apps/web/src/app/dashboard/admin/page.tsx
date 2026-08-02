"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/app/lib/api";
import { getAuthHeaders, parseJsonResponse } from "@/app/lib/auth-client";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

// Types
type Topic = { id: string; name: string; state: string };
type Chapter = { id: string; name: string; topics: Topic[] };
type Subject = { id: string; name: string; chapters: Chapter[] };

export default function AdminUploadPage() {
  const router = useRouter();
  
  // ─── 1. ALL HOOKS AT THE TOP ────────────────────────────────────────────────
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Database-driven selection states
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState(""); 
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjId, setSelectedSubjId] = useState<string>("");
  const [selectedChapId, setSelectedChapId] = useState<string>("");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Effect 1: Verify Admin Status & Fetch Unique Grades from DB
  useEffect(() => {
    let cancelled = false;
    const initAdmin = async () => {
      try {
        // 1. Verify User
        const res = await fetch(getApiUrl("/api/profile/me"), { 
          headers: { ...getAuthHeaders() } 
        });
        
        if (cancelled) return;

        if (res.ok) {
          const payload = await parseJsonResponse<any>(res);
          const role = payload.role || payload.user?.role;
          
          if (role && role.toUpperCase() === "ADMIN") {
            setIsAuthorized(true);
            
            // 2. Fetch Grades if authorized
            const gradesRes = await fetch(getApiUrl("/api/admin/grades"), { 
                headers: { ...getAuthHeaders() } 
            });
            if (gradesRes.ok) {
                const gradesData = await gradesRes.json();
                setAvailableGrades(gradesData.grades || []);
            }
          } else {
            router.replace("/dashboard/chat");
          }
        } else {
          router.replace("/login");
        }
      } catch (err) {
        if (!cancelled) router.replace("/dashboard/chat");
      }
    };
    initAdmin();
    return () => { cancelled = true; };
  }, [router]);

  // Effect 2: Fetch Curriculum for the selected Grade
  useEffect(() => {
    if (!selectedGrade) {
        setSubjects([]);
        return;
    }

    const fetchCurriculum = async () => {
      try {
        // Fetch all subjects, chapters, and topics for the specific grade string
        const res = await fetch(getApiUrl(`/api/admin/subjects?grade=${selectedGrade}`), { 
            headers: { ...getAuthHeaders() } 
        });
        if (res.ok) {
          const data = await res.json();
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        console.error("Failed to load curriculum for grade:", selectedGrade);
      }
    };
    fetchCurriculum();
  }, [selectedGrade]);

  // ─── 2. DERIVED STATE & HANDLERS ────────────────────────────────────────────
  const selectedSubject = subjects.find((s) => s.id === selectedSubjId);
  const selectedChapter = selectedSubject?.chapters.find((c) => c.id === selectedChapId);
  const selectedTopic = selectedChapter?.topics.find((t) => t.id === selectedTopicId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setMessage("");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedSubject || !selectedChapter || !selectedTopic || !selectedGrade) {
      setStatus("error");
      setMessage("Please select a grade, topic, and a PDF file.");
      return;
    }

    setStatus("uploading");
    setMessage("Processing textbook into Vector Database... This may take a minute.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("grade", selectedGrade); // Uses the DB-fetched string
    formData.append("subject", selectedSubject.name);
    formData.append("chapterId", selectedChapter.id);
    formData.append("topicId", selectedTopic.id);

    try {
      // Replace the direct port 8001 fetch with this:
      const res = await fetch(getApiUrl("/api/admin/ingest"), {
        method: "POST",
        headers: { ...getAuthHeaders() }, // Verifies the admin session
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload failed.");
      }

      const result = await res.json();
      setStatus("success");
      setMessage(`Success! ${result.message || "Textbook ingested."}`);
      setFile(null);
      
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  // ─── 3. EARLY RETURNS (Authorized check) ────────────────────────────
  if (!isAuthorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader2 size={32} color="#4f6ef7" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── 4. MAIN RENDER ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Lora:wght@500;600&display=swap');

        .vw-admin-container { padding: 40px; max-width: 800px; margin: 0 auto; font-family: 'DM Sans', sans-serif; color: #1e293b; }
        .vw-admin-header { margin-bottom: 32px; }
        .vw-admin-header h1 { font-size: 28px; font-weight: 700; font-family: 'Lora', serif; margin: 0 0 8px 0; color: #0f172a; }
        .vw-admin-header p { color: #64748b; margin: 0; font-size: 15px; }
        
        .vw-admin-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.02); }
        
        .vw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        @media (max-width: 768px) { .vw-grid { grid-template-columns: 1fr; } }
        
        .vw-form-group { display: flex; flex-direction: column; gap: 8px; }
        .vw-form-label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .vw-input, .vw-select { padding: 12px 16px; border-radius: 10px; border: 2px solid #e2e8f0; background: #f8fafc; font-size: 14px; font-weight: 500; font-family: inherit; color: #1e293b; outline: none; transition: 0.2s; appearance: none; }
        .vw-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 10 6'%3E%3Cpath fill='%2364748b' d='M5 6L0 0h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 16px center; padding-right: 40px; }
        .vw-input:focus, .vw-select:focus { border-color: #4f6ef7; background: #fff; box-shadow: 0 0 0 3px rgba(79,110,247,0.1); }
        .vw-select:disabled { opacity: 0.6; cursor: not-allowed; background-color: #f1f5f9; border-color: #e2e8f0; }
        
        .vw-divider { border: 0; height: 1px; background: #e2e8f0; margin: 32px 0; }
        
        .vw-file-drop { border: 2px dashed #cbd5e1; border-radius: 16px; padding: 40px 20px; text-align: center; background: #f8fafc; position: relative; cursor: pointer; transition: 0.2s; margin-bottom: 32px; }
        .vw-file-drop:hover { background: #f1f5f9; border-color: #94a3b8; }
        .vw-file-input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2; }
        .vw-file-content { display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none; }
        .vw-file-title { font-weight: 600; font-size: 16px; color: #1e293b; margin: 0; }
        .vw-file-sub { font-size: 13px; color: #64748b; margin: 0; }
        
        .vw-status { padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; display: flex; gap: 12px; align-items: center; font-size: 14px; font-weight: 600; line-height: 1.5; }
        .vw-status.uploading { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .vw-status.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .vw-status.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .vw-status-icon { flex-shrink: 0; }
        
        .vw-btn { width: 100%; padding: 16px; border-radius: 12px; border: none; background: linear-gradient(135deg, #4f6ef7 0%, #7c3aed 100%); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(79,124,255,0.25); display: flex; justify-content: center; align-items: center; gap: 8px; }
        .vw-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
        .vw-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(79,110,247,0.35); }
      `}</style>

      <div className="vw-admin-container">
        <header className="vw-admin-header">
          <h1>Knowledge Base Admin</h1>
          <p>Upload textbook PDFs to train the Viswasimi AI Tutor.</p>
        </header>

        <form onSubmit={handleUpload} className="vw-admin-card">
          
          <div className="vw-grid">
            {/* Database-driven Grade Selection */}
            <div className="vw-form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="vw-form-label">Database Grade / Curriculum</label>
              <select 
                className="vw-select" 
                value={selectedGrade} 
                onChange={(e) => { 
                    setSelectedGrade(e.target.value); 
                    setSelectedSubjId(""); 
                    setSelectedChapId(""); 
                    setSelectedTopicId(""); 
                }}
              >
                <option value="">-- Select Grade from Database --</option>
                {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="vw-form-group">
              <label className="vw-form-label">Subject</label>
              <select 
                value={selectedSubjId} 
                onChange={(e) => { setSelectedSubjId(e.target.value); setSelectedChapId(""); setSelectedTopicId(""); }}
                className="vw-select"
                disabled={!selectedGrade}
              >
                <option value="">Select Subject...</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="vw-form-group">
              <label className="vw-form-label">Chapter</label>
              <select 
                value={selectedChapId} 
                onChange={(e) => { setSelectedChapId(e.target.value); setSelectedTopicId(""); }}
                disabled={!selectedSubjId}
                className="vw-select"
              >
                <option value="">Select Chapter...</option>
                {selectedSubject?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="vw-form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="vw-form-label">Topic</label>
              <select 
                value={selectedTopicId} 
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedChapId}
                className="vw-select"
              >
                <option value="">Select Topic...</option>
                {selectedChapter?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <hr className="vw-divider" />

          <div className="vw-form-group">
            <label className="vw-form-label" style={{marginBottom: "8px"}}>Textbook PDF</label>
            <div className="vw-file-drop" onClick={() => document.getElementById('pdf-upload')?.click()}>
              <input 
                type="file" 
                id="pdf-upload"
                accept="application/pdf"
                onChange={handleFileChange}
                className="vw-file-input"
              />
              <div className="vw-file-content">
                {file ? (
                  <>
                    <FileText size={42} color="#4f6ef7" />
                    <p className="vw-file-title">{file.name}</p>
                    <p className="vw-file-sub">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <Upload size={42} color="#94a3b8" />
                    <p className="vw-file-title">Click to select PDF for training</p>
                    <p className="vw-file-sub">PDF content will be vectorized for the RAG system.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {status !== "idle" && (
            <div className={`vw-status ${status}`}>
              {status === "uploading" && <Loader2 size={20} className="vw-status-icon" style={{ animation: 'spin 1s linear infinite' }} />}
              {status === "success" && <CheckCircle size={20} className="vw-status-icon" />}
              {status === "error" && <AlertCircle size={20} className="vw-status-icon" />}
              <span>{message}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={status === "uploading" || !file || !selectedTopicId}
            className="vw-btn"
          >
            {status === "uploading" ? "Uploading & Vectorizing..." : "Upload & Train AI"}
          </button>
        </form>
      </div>
    </>
  );
}
