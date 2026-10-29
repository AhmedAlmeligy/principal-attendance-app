/**
 * Stable per-device identity kept in this device's own storage.
 *
 * It is what ties an anonymous Convex account to the physical device, so an
 * admin can block *this* device even after it signs out and back in — the
 * tombstone survives a new session, and clearing site data is the only way
 * around it (good enough for a school-issued device).
 */

const ID_KEY = "hader:device-id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "ephemeral-device";
  }
}

/** Short human label for the admin console, e.g. "Android · تطبيق الهاتف". */
export function getDeviceLabel(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "جهاز";
  // The APK's WebView always advertises "; wv" — check it before Chrome.
  const kind = /; wv/i.test(ua)
    ? "تطبيق الهاتف"
    : /FBAN|FBAV/i.test(ua)
      ? "Facebook"
      : /Edg\//i.test(ua)
        ? "Edge"
        : /OPR\//i.test(ua)
          ? "Opera"
          : /Chrome\//i.test(ua)
            ? "Chrome"
            : /Safari\//i.test(ua)
              ? "Safari"
              : /Firefox\//i.test(ua)
                ? "Firefox"
                : "متصفح";
  return `${os} · ${kind}`;
}
