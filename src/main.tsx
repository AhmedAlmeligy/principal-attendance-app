import { Toaster } from "@/components/ui/sonner";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, {
  StrictMode,
  useEffect,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Home = lazy(() => import("./pages/Home.tsx"));
const Attendance = lazy(() => import("./pages/Attendance.tsx"));
const Employees = lazy(() => import("./pages/Employees.tsx"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

import { AppProvider } from "@/providers/app-provider";
import { BottomNav, TABS } from "@/components/app/BottomNav";
import { BiometricGate } from "@/components/BiometricGate";
import { AccountGate } from "@/providers/account-gate";
import { SwipeNavigator } from "@/components/app/SwipeNavigator";
import { registerConvexClient } from "@/lib/sync-client";
import { startAnalytics, trackPageview } from "@/lib/analytics";
import { TermsGate } from "@/components/TermsGate";
import { syncNativeTheme } from "@/lib/android-bridge";
import { ThemeProvider, useTheme } from "next-themes";

/**
 * Mirrors the in-app light/dark choice onto the Android status/navigation
 * bars (the shell cannot see localStorage, and the phone's system theme may
 * differ from the one picked inside the app). No-op outside the app.
 */
function NativeThemeSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    syncNativeTheme(resolvedTheme === "dark");
  }, [resolvedTheme]);
  return null;
}

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-primary/30" />
    </div>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">خطأ في التطبيق</p>
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 max-h-40 overflow-auto rounded border border-border/60 p-2 text-left text-[10px] leading-4 text-muted-foreground/80">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Convex is optional at runtime: without VITE_CONVEX_URL (e.g. a static
// GitHub Pages build) the app runs local-only. Auth and query hooks still
// need a provider in the tree, so a client is always created — but in
// local-only mode it gets a WebSocket that never connects instead of
// dialling (and failing against) a placeholder host.
class SilentWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  url = "";
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  constructor(url?: string | URL) {
    this.url = String(url ?? "");
  }
  send() {
    /* never sends: local-only build */
  }
  close() {
    this.readyState = 3;
  }
  addEventListener() {
    /* no events ever fire */
  }
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
}

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convex = new ConvexReactClient(
  convexUrl || "https://local-only.invalid",
  {
    webSocketConstructor: (convexUrl
      ? undefined
      : SilentWebSocket) as typeof WebSocket | undefined,
  },
);
// Local-only mode never registers the client: the sync engine reports
// "offline" and keeps queued operations safe until a backend is configured.
if (convexUrl) registerConvexClient(convex);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Starts PostHog (only once the terms/privacy gate has been accepted) and
 *  records one pageview per route change for the usage funnel. */
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);

  return null;
}

// Module scope (same pattern as the unlock flag in lib/biometric.ts): the
// direction of a page transition is decided by the navigation that just
// happened, and must survive this layout's remounts without tripping the
// render-phase ref/setState rules.
let lastAnimatedPath = "";

/** Layout for authenticated app pages: sync engine + bottom navigation. */
function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  // RTL tab order runs right → left, so moving to the next tab slides the new
  // page in from the left edge and going back brings it in from the right.
  const tabIndex = (path: string) =>
    TABS.findIndex((tab) => (tab.exact ? path === tab.path : path.startsWith(tab.path)));
  const from = tabIndex(lastAnimatedPath);
  const to = tabIndex(pathname);
  const forward = from === -1 || to === -1 ? true : to > from;

  useEffect(() => {
    lastAnimatedPath = pathname;
  }, [pathname]);

  return (
    <AppProvider>
      <AccountGate>
        <BiometricGate>
          <SwipeNavigator>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, x: forward ? -26 : 26 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
            <BottomNav />
          </SwipeNavigator>
        </BiometricGate>
      </AccountGate>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <TermsGate>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <NativeThemeSync />
        <ConvexAuthProvider client={convex}>
          {/* GitHub Pages serves the app from /<repo>/ — BASE_URL is baked in
              at build time and is "/" everywhere else. */}
          <BrowserRouter
            basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}
          >
          <RouteSyncer />
          <AnalyticsTracker />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/app"
                element={
                  <AppLayout>
                    <Home />
                  </AppLayout>
                }
              />
              <Route
                path="/app/attendance"
                element={
                  <AppLayout>
                    <Attendance />
                  </AppLayout>
                }
              />
              <Route
                path="/app/employees"
                element={
                  <AppLayout>
                    <Employees />
                  </AppLayout>
                }
              />
              <Route
                path="/app/employees/:id"
                element={
                  <AppLayout>
                    <EmployeeDetail />
                  </AppLayout>
                }
              />
              <Route
                path="/app/reports"
                element={
                  <AppLayout>
                    <Reports />
                  </AppLayout>
                }
              />
              <Route
                path="/app/messages"
                element={
                  <AppLayout>
                    <Messages />
                  </AppLayout>
                }
              />
              <Route
                path="/app/settings"
                element={
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                }
              />
              <Route
                path="/app/admin"
                element={
                  <AppLayout>
                    <Admin />
                  </AppLayout>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      </ThemeProvider>
      </TermsGate>
    </RootErrorBoundary>
  </StrictMode>,
);
