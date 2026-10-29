import posthog from "posthog-js";

/**
 * Product analytics for حاضِر (PostHog).
 *
 * Consent comes first: nothing is initialised or sent until the principal has
 * accepted the terms & privacy policy, and Settings carries a switch that turns
 * analytics off again. Without `VITE_POSTHOG_KEY` every helper below is a
 * no-op, so local builds and offline installs behave exactly as before.
 *
 * Only counts, enum values and UI paths are captured — never employee names,
 * phone numbers or attendance notes.
 */

type EventProps = Record<string, string | number | boolean | undefined>;

const CONSENT_KEY = "hader:analytics-consent";
const DISTINCT_ID_KEY = "hader:analytics-id";

const projectKey = (
  import.meta.env.VITE_POSTHOG_KEY as string | undefined
)?.trim();
const apiHost =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined)?.trim() ||
  "https://us.i.posthog.com";

/** The app has no accounts, so a random per-device id is the PostHog distinct
 *  id. It is stable across launches, which is what makes funnels and retention
 *  meaningful for a single-school device. */
let fallbackId: string | null = null;
let initialized = false;
let active = false;

export function analyticsConfigured(): boolean {
  return Boolean(projectKey);
}

export function getAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

function storeConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* private mode — the choice simply does not persist */
  }
}

function deviceId(): string {
  try {
    const stored = localStorage.getItem(DISTINCT_ID_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(DISTINCT_ID_KEY, id);
    return id;
  } catch {
    fallbackId ??= crypto.randomUUID();
    return fallbackId;
  }
}

function clean(props: EventProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Initialise PostHog for this device — only once consent has been granted. */
export function startAnalytics(): void {
  if (active || typeof window === "undefined") return;
  if (!projectKey || !getAnalyticsConsent()) return;

  if (!initialized) {
    posthog.init(projectKey, {
      api_host: apiHost,
      // Pageviews are captured per route in `trackPageview`; autocapture still
      // records taps on elements so feature adoption is visible.
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
      // School records are personal data: never record sessions.
      disable_session_recording: true,
      respect_dnt: true,
    });
    initialized = true;
  }

  posthog.opt_in_capturing();
  active = true;
  identifyAnalytics();
}

/** Identify the current device, optionally attaching (or updating) properties. */
export function identifyAnalytics(props: EventProps = {}): void {
  if (!active) return;
  posthog.identify(
    deviceId(),
    clean({ app: "hadir", role: "principal", ...props }),
  );
}

/** Capture a product event. Dropped silently unless consent is active. */
export function captureEvent(event: string, props: EventProps = {}): void {
  if (!active) return;
  posthog.capture(event, clean(props));
}

/** Record a route view — the backbone of the onboarding/usage funnel. */
export function trackPageview(path: string): void {
  if (!active) return;
  posthog.capture("$pageview", {
    $current_url: window.location.href,
    path,
  });
}

/**
 * Persist the principal's choice. Granting starts capture immediately;
 * revoking opts out and clears the stored identity — nothing is sent after a
 * withdrawal of consent.
 */
export function setAnalyticsConsent(granted: boolean): void {
  storeConsent(granted);

  if (granted) {
    startAnalytics();
    return;
  }

  if (initialized) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
  active = false;
}
