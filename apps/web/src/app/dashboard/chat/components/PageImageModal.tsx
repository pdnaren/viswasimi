export function PageImageModal({ src, onClose }: { src: string; onClose: () => void }) {
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
