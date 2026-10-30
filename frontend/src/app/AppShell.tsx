import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";

function PageFallback() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="app-background" aria-hidden />
      <div className="noise" aria-hidden />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative z-10 lg:pl-[272px]">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          onSearch={() => setPaletteOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <ErrorBoundary
            fallback={
              <ErrorState
                title="This view hit an unexpected error"
                message="Reload the page or move to another section. The rest of the application remains available."
              />
            }
          >
            <Suspense fallback={<PageFallback />}>
              <div key={location.pathname} className="page-enter">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
          <footer className="mt-12 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10px] leading-4 text-mist/55 sm:flex-row sm:items-center sm:justify-between">
            <span>
              IdentityShield AI · Research prototype · Synthetic identities and access events
            </span>
            <span>
              Risk signals are investigation aids, not proof of compromise.
            </span>
          </footer>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
