import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginRequest } from "@/services/api/endpoints";
import { UNAUTHORIZED_EVENT } from "@/services/api/client";
import {
  clearSession,
  readSession,
  sessionFromToken,
  writeSession,
} from "@/services/auth/session";
import type { Role, Session } from "@/types/api";

interface AuthContextValue {
  session: Session | null;
  isReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setIsReady(true);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSession(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginRequest(username.trim(), password);
    const nextSession = sessionFromToken(result.token);
    if (!nextSession) {
      throw new Error("The issued token is invalid or already expired.");
    }
    writeSession(nextSession);
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(session && roles.includes(session.user.role)),
    [session],
  );

  const value = useMemo(
    () => ({ session, isReady, login, logout, hasRole }),
    [session, isReady, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
