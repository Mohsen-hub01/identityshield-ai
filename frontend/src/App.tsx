import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { ShieldMark } from "@/components/brand/ShieldMark";
import { ProtectedRoute } from "@/services/auth/ProtectedRoute";
import { AuthProvider } from "@/services/auth/AuthContext";
import { PreferencesProvider } from "@/services/preferences/PreferencesContext";
import { ApiError } from "@/services/api/client";

const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const CopilotPage = lazy(() =>
  import("@/features/copilot/CopilotPage").then((module) => ({
    default: module.CopilotPage,
  })),
);
const IdentitiesPage = lazy(() =>
  import("@/features/identities/IdentitiesPage").then((module) => ({
    default: module.IdentitiesPage,
  })),
);
const IdentityDetailPage = lazy(() =>
  import("@/features/identities/IdentityDetailPage").then((module) => ({
    default: module.IdentityDetailPage,
  })),
);
const ThreatIntelligencePage = lazy(() =>
  import("@/features/threats/ThreatIntelligencePage").then((module) => ({
    default: module.ThreatIntelligencePage,
  })),
);
const RiskAnalysisPage = lazy(() =>
  import("@/features/risk/RiskAnalysisPage").then((module) => ({
    default: module.RiskAnalysisPage,
  })),
);
const IncidentReviewPage = lazy(() =>
  import("@/features/incidents/IncidentReviewPage").then((module) => ({
    default: module.IncidentReviewPage,
  })),
);
const PlaybooksPage = lazy(() =>
  import("@/features/playbooks/PlaybooksPage").then((module) => ({
    default: module.PlaybooksPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/features/not-found/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <ShieldMark />
        <p className="text-[11px] text-mist">Loading secure view…</p>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="copilot" element={<CopilotPage />} />
                    <Route path="identities" element={<IdentitiesPage />} />
                    <Route
                      path="identities/:userId"
                      element={<IdentityDetailPage />}
                    />
                    <Route path="threats" element={<ThreatIntelligencePage />} />
                    <Route path="risk" element={<RiskAnalysisPage />} />
                    <Route path="incidents" element={<IncidentReviewPage />} />
                    <Route path="playbooks" element={<PlaybooksPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
