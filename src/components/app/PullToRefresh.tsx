import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/providers/app-provider";
import { syncNow } from "@/lib/sync-client";
import { cn } from "@/lib/utils";

/**
 * Pull-to-refresh for the app pages.
 *
 * Dragging down while the page is at its very top reveals an indicator; past
 * the threshold it releases into a manual sync (queue flush + pull) followed
 * by a local refresh, so the board reflects what the backend sent back.
 *
 * Guard rails:
 * - only a single finger, and only when the document is scrolled to the top,
 *   so normal scrolling and the horizontal SwipeNavigator are unaffected;
 * - dialogs and form fields are ignored (a drag there belongs to the control);
 * - the touchmove listener is non-passive so the browser's own rubber-band /
 *   native pull-to-refresh does not fight the gesture.
 */
const THRESHOLD = 64;
const MAX_PULL = 104;
const RESISTANCE = 0.5;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const { refresh } = useApp();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const busyRef = useRef(false);
  const pullRef = useRef(0);

  const runRefresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    pullRef.current = THRESHOLD;
    setPull(THRESHOLD);
    try {
      // A manual pull reconciles deletions too, so ask for the full pass.
      await syncNow({ full: true });
      await refresh();
      setDone(true);
      toast.success("تم تحديث البيانات");
    } catch (err) {
      console.error(err);
      toast.error("تعذر التحديث، حاول مجدداً");
    } finally {
      window.setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
        setDone(false);
        pullRef.current = 0;
        setPull(0);
      }, 450);
    }
  }, [refresh]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const reset = () => {
      active.current = false;
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || busyRef.current || !atTop()) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('[role="dialog"], input, textarea, select')) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        // Swiping up again: hand the gesture back to normal scrolling.
        if (pullRef.current > 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      if (!atTop()) {
        reset();
        return;
      }
      // Keep the page from scrolling/rubber-banding under the finger.
      if (e.cancelable) e.preventDefault();
      const resisted = Math.min(MAX_PULL, dy * RESISTANCE);
      pullRef.current = resisted;
      setPull(resisted);
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        void runRefresh();
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", reset);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", reset);
    };
  }, [runRefresh]);

  const progress = Math.min(1, pull / THRESHOLD);
  const armed = pull >= THRESHOLD;

  return (
    <div ref={wrapRef} className="relative" style={{ overscrollBehaviorY: "contain" }}>
      {/* Pull indicator */}
      <div
        aria-hidden={!busy && pull === 0}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-center",
          "transition-opacity",
        )}
        style={{ opacity: busy || pull > 4 ? 1 : 0, height: pull || (busy ? THRESHOLD : 0) }}
      >
        <div
          className="glass-chip mt-2 flex size-9 items-center justify-center rounded-full shadow-sm"
          role="status"
          aria-live="polite"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : done ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <ArrowDown
              className="size-4 text-primary transition-transform"
              style={{
                transform: `rotate(${Math.round((armed ? 1 : progress) * 180)}deg)`,
              }}
            />
          )}
        </div>
        <span className="sr-only">
          {busy ? "جارٍ المزامنة…" : armed ? "أفلت للتحديث" : "اسحب للأسفل للتحديث"}
        </span>
      </div>

      <div
        style={{
          transform: pull ? `translate3d(0, ${pull}px, 0)` : undefined,
          transition: pull > 0 && !busy ? "none" : "transform 220ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
