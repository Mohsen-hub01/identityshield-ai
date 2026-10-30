import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { useAuth } from "@/services/auth/AuthContext";

export function ProtectedRoute() {
  const { session, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ShieldMark />
          <p className="text-xs text-mist">Restoring secure session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
