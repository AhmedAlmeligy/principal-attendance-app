/**
 * Bridges the page to the Android shell (the WebView host app).
 *
 * The host injects `AndroidFiles` and `AndroidTheme` before the page loads.
 * Everything degrades gracefully on the web: when a bridge is missing the
 * callers fall back to the browser's own download / share APIs.
 */

interface AndroidFilesBridge {
  savePdf(base64: string, filename: string): void;
  sharePdf(base64: string, filename: string): void;
}

interface AndroidThemeBridge {
  setDark(dark: boolean): void;
}

declare global {
  interface Window {
    AndroidFiles?: AndroidFilesBridge;
    AndroidTheme?: AndroidThemeBridge;
  }
}

/** The injected file bridge when running inside the Android app. */
export function getAndroidFiles(): AndroidFilesBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const bridge = window.AndroidFiles;
  if (!bridge || typeof bridge.savePdf !== "function") return undefined;
  return bridge;
}

/** True when running inside the Android shell. */
export function isAndroidApp(): boolean {
  return getAndroidFiles() !== undefined;
}

/** Keep the native status/nav bar colours in step with the in-app theme. */
export function syncNativeTheme(dark: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.AndroidTheme?.setDark(dark);
  } catch (err) {
    console.warn("[android] theme bridge failed:", err);
  }
}
