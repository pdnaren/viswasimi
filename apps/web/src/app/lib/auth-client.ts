const SESSION_COOKIE_NAME = "viswasimi_session";

type ApiErrorPayload = {
  error?: string;
  detail?: string;
  message?: string;
  rawText?: string;
};

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      message: text.includes("<html") ? response.statusText || "Unexpected non-JSON response from server" : text,
      rawText: text,
    } as T;
  }
}

export function getApiErrorMessage(payload: ApiErrorPayload | null | undefined, fallback: string): string {
  return payload?.error || payload?.detail || payload?.message || fallback;
}

export function getFetchErrorMessage(error: unknown, apiUrl: string): string {
  if (error instanceof Error && error.message) {
    return `${error.message}. Request URL: ${apiUrl}`;
  }
  return `Could not reach the backend API. Request URL: ${apiUrl}`;
}

export function persistSessionToken(token: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}

export function clearSessionToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

export function getAuthHeaders(): HeadersInit {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_state_mismatch: "Your sign-in session expired. Please try again.",
  google_unavailable: "Couldn't reach Google right now. Please try again.",
  google_email_unverified: "Your Google account's email isn't verified.",
  google_not_configured: "Google sign-in isn't set up on this server yet.",
};

export function getGoogleErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return GOOGLE_ERROR_MESSAGES[code] || "Google sign-in failed. Please try again.";
}
