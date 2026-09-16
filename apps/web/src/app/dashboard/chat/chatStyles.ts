// Extracted verbatim from the chat page's inline <style> block — no rule
// changed, just moved out of the component file to cut its length down.
export const CHAT_STYLES = `
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

  /* ── Mobile ─────────────────────────────────────────────────────────── */
  .vw-mobile-menu-btn{display:none;background:none;border:none;cursor:pointer;color:#1e293b;padding:4px;border-radius:8px;align-items:center;flex-shrink:0}
  .vw-mobile-menu-btn:hover{background:rgba(0,0,0,.05)}
  .vw-sidebar-backdrop{display:none}
  @media (max-width: 860px) {
    .vw-mobile-menu-btn{display:flex}
    .vw-toggle{display:none}
    .vw-sb{
      position:fixed !important; top:0; left:0; height:100dvh;
      width:280px !important; min-width:280px !important;
      transform:translateX(-100%); transition:transform .25s ease;
      z-index:1000; box-shadow:4px 0 24px rgba(0,0,0,.12);
    }
    .vw-sb.mobile-open{transform:translateX(0)}
    .vw-sb .vw-sb-inner{width:280px !important; padding:20px !important; align-items:stretch !important}
    .vw-sidebar-backdrop.open{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:900}
    .vw-inner{max-width:96%}
    .vw-header{padding:10px 14px}
  }
`;
