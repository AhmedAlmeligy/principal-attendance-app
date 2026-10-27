import { useRef, type ReactNode, type TouchEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { TABS } from "./BottomNav";

/**
 * Horizontal swipe navigation between the bottom-nav pages.
 *
 * The app is RTL, so the visual order of the tabs runs right → left: the
 * next page sits to the LEFT of the current one, which means dragging your
 * finger to the RIGHT pulls in the next page and to the LEFT goes back
 * (mirrored from LTR apps).
 *
 * Guard rails so the gesture never fights the UI:
 * - only single-finger, horizontally-dominant swipes (|dx| > |dy|) with a
 *   decent travel (≥ 64px) and a quick duration — vertical scrolling and
 *   slow drags are never hijacked;
 * - starts on form fields, dialogs, <nav>, or horizontally-scrollable
 *   elements are ignored;
 * - no wrap-around: at the first/last tab the swipe does nothing.
 */
const MIN_TRAVEL = 64;
const MAX_DURATION_MS = 600;
const HORIZONTAL_BIAS = 1.4;

function canScrollHorizontally(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node) {
    const { overflowX } = getComputedStyle(node);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 8
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="dialog"], nav',
    )
  ) {
    return true;
  }
  return canScrollHorizontally(target);
}

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const blocked = useRef(false);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    blocked.current = shouldIgnore(e.target);
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || blocked.current) return;

    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Date.now() - s.t > MAX_DURATION_MS) return;
    if (Math.abs(dx) < MIN_TRAVEL) return;
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_BIAS) return;

    const index = TABS.findIndex((tab) =>
      tab.exact ? pathname === tab.path : pathname.startsWith(tab.path),
    );
    if (index === -1) return;

    // RTL: finger to the right (dx > 0) pulls in the NEXT page.
    const next = dx > 0 ? index + 1 : index - 1;
    if (next < 0 || next >= TABS.length) return;
    navigate(TABS[next].path);
  };

  return (
    <div
      className="min-h-screen"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
