import { api } from "@/shared/api";
import type { SessionUser } from "../model/session-store";

export async function fetchSession(): Promise<SessionUser | null> {
  const { data, response } = await api.GET("/user/me", { cache: "no-store" });
  if (response.status === 401) return null;
  if (!response.ok || !data) throw new Error("Session check failed");
  return data;
}
