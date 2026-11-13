import { api } from "@/shared/api";
import type { SessionUser } from "@/entities/session";

export async function login(username: string, password: string): Promise<SessionUser> {
  let result;
  try {
    result = await api.POST("/auth/login", {
      body: { username, password },
    });
  } catch {
    throw new Error("We couldn’t reach the server. Please try again.");
  }

  if (!result.response.ok) {
    if (result.response.status === 400 || result.response.status === 401) {
      throw new Error("Check your username and password, then try again.");
    }
    if (result.response.status === 429) {
      throw new Error("Too many attempts. Please wait a moment and try again.");
    }
    throw new Error("We couldn’t log you in right now. Please try again.");
  }
  if (!result.data) throw new Error("We couldn’t read your account. Please try again.");
  return result.data;
}
