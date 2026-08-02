import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "@/app/lib/api";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  grade: number;
  role: string;
  locale: string;
  timezone: string;
  createdAt?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("viswasimi_session")?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${getServerApiBaseUrl()}/api/auth/me`, {
      headers: {
        Cookie: `viswasimi_session=${encodeURIComponent(token)}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { user?: CurrentUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}
