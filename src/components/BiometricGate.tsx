import { Button } from "@/components/ui/button";
import {
  BIOMETRIC_CHANGE_EVENT,
  useBiometric,
} from "@/hooks/use-biometric";
import {
  isBiometricEnabled,
  isUnlockedThisSession,
  markLocked,
  unlockWithBiometric,
} from "@/lib/biometric";
import { cn } from "@/lib/utils";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Full-screen biometric lock gate. Renders the app when unlocked, or a
 * fingerprint screen whenever the app is (re)opened while a lock is enabled.
 *
 * The unlock state lives at module scope in `biometric.ts`, so route changes
 * (which remount this component) never re-lock the app — only a fresh page
 * load or returning from the background does.
 *
 * Auto re-locks when the tab/app goes to the background (visibilitychange),
 * so the "stay logged in" session is protected on every return to the app.
 */
export function BiometricGate({ children }: { children: React.ReactNode }) {
  const { supported } = useBiometric();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  const evaluate = useCallback(async () => {
    const isEnabled = await isBiometricEnabled();
    setEnabled(isEnabled);
    if (!isEnabled || isUnlockedThisSession()) {
      setLocked(false);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await evaluate();
    })();
  }, [evaluate]);

  // Re-lock when the app is sent to the background.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        markLocked();
        setLocked(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleUnlock = useCallback(async () => {
    setVerifying(true);
    try {
      const result = await unlockWithBiometric();
      if (result.ok) {
        setLocked(false);
      } else {
        toast.error(result.message);
      }
    } finally {
      setVerifying(false);
    }
  }, []);

  // Follow enroll/disable changes made in Settings (same tab or another one).
  useEffect(() => {
    function onChange() {
      void isBiometricEnabled().then((v) => {
        setEnabled(v);
        if (!v) {
          setLocked(false);
        } else if (!isUnlockedThisSession()) {
          setLocked(true);
        }
      });
    }
    window.addEventListener(BIOMETRIC_CHANGE_EVENT, onChange);
    return () =>
      window.removeEventListener(BIOMETRIC_CHANGE_EVENT, onChange);
  }, []);

  if (checking) {
    // Neutral splash while reading the lock state — avoids flashing app data.
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-pulse rounded-full bg-primary/30" />
      </div>
    );
  }

  if (!locked || !supported || enabled === false) {
    return <>{children}</>;
  }

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <div className="glass-strong w-full max-w-sm space-y-5 rounded-3xl p-7">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full">
          <span className="glass-chip flex size-20 items-center justify-center rounded-full">
            <Fingerprint
              className={cn(
                "size-10 text-primary",
                verifying && "animate-pulse",
              )}
            />
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-lg font-extrabold">التطبيق مقفل</h1>
          <p className="text-xs leading-6 text-muted-foreground">
            استخدم بصمتك أو قفل جهازك للدخول إلى تطبيق مدير المدرسة
          </p>
        </div>

        <Button
          className="h-12 w-full rounded-xl text-sm font-bold"
          onClick={() => void handleUnlock()}
          disabled={verifying}
        >
          {verifying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              جاري التحقق…
            </>
          ) : (
            <>
              <Fingerprint className="size-4" />
              فتح بالبصمة
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          محمي بقياسات جهازك الحيوية — البيانات تبقى على هاتفك
        </p>
      </div>
    </div>
  );
}
