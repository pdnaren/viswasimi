  function normalizeBaseUrl(value: string | undefined): string {
    return (value || "").trim().replace(/\/$/, "");
  }

  export function getApiBaseUrl(): string {
    const envBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
    if (envBase) return envBase;

    if (typeof window !== "undefined") {
      const { hostname, protocol } = window.location;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `${protocol}//${hostname}:8000`;
      }
    }

    return "";
  }

  export function getServerApiBaseUrl(): string {
    const envBase = normalizeBaseUrl(process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL);
    if (envBase) return envBase;
    return "http://127.0.0.1:8000";
  }

  export function getApiUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const base = getApiBaseUrl();
    return base ? `${base}${normalizedPath}` : normalizedPath;
  }
