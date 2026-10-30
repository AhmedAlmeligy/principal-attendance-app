import { api } from "@/convex/_generated/api";
import { getDeviceId, getDeviceLabel } from "@/lib/device";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useConvex, useQuery } from "convex/react";
import { PowerOff, ShieldOff } from "lucide-react";
import { Component, useEffect, type ReactNode } from "react";

// Module scope: the anonymous sign-in runs once per page load, whatever
// remounts happen around it (same pattern as the unlock flag in biometric.ts).
let signInAttempted = false;
let registerAttempted = false;

/**
 * Catches a failing Convex query (e.g. the account functions are not deployed
 * on this backend yet) and renders `fallback` instead of crashing the app.
 */
export class QueryFallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn(
      "[account] status query unavailable:",
      err instanceof Error ? err.message : err,
    );
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Registers this device as an account and enforces the admin's control.
 *
 * - On first launch the device signs in anonymously (there is no password or
 *   e-mail) and registers itself, which is what makes it show up in the admin
 *   console — the first device to register becomes the admin.
 * - `devices.status` is a live query: revoking this device or flipping the
 *   global kill switch shuts the app down here immediately (next sync at the
 *   latest). Offline, local-only, or not-yet-deployed builds never block.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const client = useConvex();

  // 1) Sign in once per page load when we have no valid session.
  useEffect(() => {
    if (isLoading || isAuthenticated || signInAttempted) return;
    signInAttempted = true;
    void signIn("anonymous").catch((err) => {
      // Offline / local-only / backend not deployed: the app keeps working
      // without an account. Reset so a later effect run can retry.
      signInAttempted = false;
      console.error("[account] anonymous sign-in skipped:", err);
    });
  }, [isLoading, isAuthenticated, signIn]);

  // 2) Register the device once authenticated. This runs on every load (not
  // only right after sign-in) so an already-signed-in device still shows up
  // in the admin console. `signIn()` resolves as soon as the JWT is stored —
  // the websocket can still be finishing its re-auth handshake, so the first
  // attempt may land unauthenticated; retry with a short backoff rather than
  // dropping the registration. (`devices.register` is idempotent.)
  useEffect(() => {
    if (!isAuthenticated || registerAttempted) return;
    registerAttempted = true;
    void (async () => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await client.mutation(api.devices.register, {
            deviceId: getDeviceId(),
            deviceName: getDeviceLabel(),
          });
          return;
        } catch (err) {
          lastErr = err;
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
      // Backend not reachable / not deployed: keep working locally, but let
      // a later effect run (e.g. next mount) try again.
      registerAttempted = false;
      console.error("[account] device registration skipped:", lastErr);
    })();
  }, [isAuthenticated, client]);

  return (
    <QueryFallback fallback={<>{children}</>}>
      <StatusGate>{children}</StatusGate>
    </QueryFallback>
  );
}

function StatusGate({ children }: { children: ReactNode }) {
  const status = useQuery(api.devices.status);

  if (status?.appDisabled) {
    return (
      <BlockedScreen
        icon={<PowerOff className="size-9" />}
        title="التطبيق موقوف"
        message={
          status.message ||
          "تم إيقاف التطبيق من لوحة الإدارة. تواصل مع مدير النظام لإعادة التفعيل."
        }
      />
    );
  }

  if (status?.signedIn && status.revoked) {
    return (
      <BlockedScreen
        icon={<ShieldOff className="size-9" />}
        title="تم إيقاف حسابك"
        message="هذا الجهاز موقوف من لوحة الإدارة ولا يمكنه استخدام التطبيق. تواصل مع مدير النظام."
      />
    );
  }

  return <>{children}</>;
}

function BlockedScreen({
  icon,
  title,
  message,
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center px-6 text-center"
    >
      <div className="glass-strong w-full max-w-sm space-y-4 rounded-3xl p-7">
        <div className="mx-auto flex size-16 items-center justify-center">
          <span className="glass-chip flex size-16 items-center justify-center rounded-full text-destructive">
            {icon}
          </span>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-extrabold">{title}</h1>
          <p className="text-xs leading-6 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
