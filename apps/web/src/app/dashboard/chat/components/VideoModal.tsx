function toEmbedUrl(src: string): string | null {
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      return null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoModal({ src, onClose }: { src: string; onClose: () => void }) {
  const embedUrl = toEmbedUrl(src);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 900 }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -12, right: -12, width: 32, height: 32,
            borderRadius: "50%", border: "none", background: "#fff",
            fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 1,
          }}
        >×</button>

        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", background: "#000" }}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title="Topic video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <video
              src={src}
              controls
              autoPlay
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
