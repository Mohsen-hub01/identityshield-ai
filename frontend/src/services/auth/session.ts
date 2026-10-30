import type { Role, Session, SessionUser } from "@/types/api";

export const SESSION_STORAGE_KEY = "identityshield.session";

interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(window.atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function sessionFromToken(token: string): Session | null {
  const payload = decodeJwt(token);
  if (!payload?.sub || !payload.role || !payload.exp) return null;

  const role = payload.role as Role;
  if (!["admin", "analyst", "viewer"].includes(role)) return null;

  const expiresAt = payload.exp * 1000;
  if (expiresAt <= Date.now()) return null;

  return {
    token,
    user: { username: payload.sub, role },
    expiresAt,
  };
}

export function readSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || !parsed.user || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function roleLabel(role: Role | SessionUser["role"]): string {
  if (role === "admin") return "Administrator";
  if (role === "analyst") return "Security Analyst";
  return "Viewer";
}

export function canAnalyze(role: Role | undefined): boolean {
  return role === "admin" || role === "analyst";
}
