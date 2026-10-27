/**
 * Biometric app lock using the WebAuthn platform authenticator
 * (fingerprint / Face ID / device PIN). Keys never leave the device; the
 * browser asks the OS to verify the owner's biometrics locally.
 *
 * Enrollment stores a credential id in IndexedDB meta. Unlocking performs a
 * `get()` assertion against that credential — it requires a real fingerprint
 * scan every time, so it is a genuine local check, not just a stored flag.
 */

import { getMeta, setMeta, deleteMeta } from "./local-db";

const CREDENTIAL_KEY = "biometric.credentialId";
const LAST_UNLOCK_KEY = "biometric.lastUnlockAt";

// Session unlock flag (module scope — survives route remounts, resets on a
// full page reload, which is exactly the lifecycle an app lock needs).
let unlockedThisSession = false;

/** True when the current page load has already passed a biometric check. */
export function isUnlockedThisSession(): boolean {
  return unlockedThisSession;
}

export function markUnlocked(): void {
  unlockedThisSession = true;
}

export function markLocked(): void {
  unlockedThisSession = false;
}

export type BiometricEnrollResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "cancelled" | "failed"; message: string };

export type BiometricUnlockResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "failed" | "missing"; message: string };

// ---------- low-level helpers ----------

/** Base64url-encode an ArrayBuffer (WebAuthn expects base64url strings). */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string back to bytes. */
export function base64UrlToBuffer(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  return bufferToBase64Url(bytes.buffer as ArrayBuffer);
}

/** True when this browser/device exposes a platform biometric authenticator. */
export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    // Not on a plain http origin — WebAuthn requires a secure context.
    window.isSecureContext === true
  );
}

/**
 * Best-effort check that a platform authenticator with biometrics is actually
 * available (not just that WebAuthn exists). Falls back to `true` on browsers
 * that don't implement the conditional-mediation availability probe.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    const p = window.PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    };
    if (typeof p.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await p.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    // probe failed — assume supported since the base check passed
  }
  return true;
}

export async function getStoredCredentialId(): Promise<string | undefined> {
  return getMeta<string>(CREDENTIAL_KEY);
}

// ---------- enrollment ----------

/** Register a device-local credential; the OS prompts for biometric setup. */
export async function enrollBiometric(
  displayName: string,
): Promise<BiometricEnrollResult> {
  if (!isBiometricSupported()) {
    return {
      ok: false,
      reason: "unsupported",
      message: "جهازك لا يدعم القياسات الحيوية",
    };
  }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "تطبيق مدير المدرسة", id: location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "principal",
          displayName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "required",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) {
      return {
        ok: false,
        reason: "failed",
        message: "تعذر إنشاء بيانات القياس الحيوي",
      };
    }
    await setMeta(CREDENTIAL_KEY, cred.id);
    // Enrolling requires a successful scan, so count it as an unlock for
    // this session (prevents instantly re-locking the open app).
    markUnlocked();
    return { ok: true };
  } catch (err) {
    if (isUserCancellation(err)) {
      return { ok: false, reason: "cancelled", message: "تم إلغاء التسجيل" };
    }
    console.error("[biometric] enroll failed:", err);
    return {
      ok: false,
      reason: "failed",
      message: err instanceof Error ? err.message : "فشل تسجيل القياس الحيوي",
    };
  }
}

// ---------- unlock ----------

/**
 * Run a real biometric assertion (fingerprint prompt) against the stored
 * credential. Returns ok only when the user verified successfully.
 */
export async function unlockWithBiometric(): Promise<BiometricUnlockResult> {
  const credId = await getStoredCredentialId();
  if (!credId) {
    return { ok: false, reason: "missing", message: "القياس الحيوي غير مُفعّل" };
  }
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [
          { type: "public-key", id: base64UrlToBuffer(credId) },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { ok: false, reason: "failed", message: "فشل التحقق" };
    }
    await setMeta(LAST_UNLOCK_KEY, Date.now());
    markUnlocked();
    return { ok: true };
  } catch (err) {
    if (isUserCancellation(err)) {
      return {
        ok: false,
        reason: "cancelled",
        message: "تم إلغاء التحقق — حاول مجدداً",
      };
    }
    console.error("[biometric] unlock failed:", err);
    return {
      ok: false,
      reason: "failed",
      message: err instanceof Error ? err.message : "فشل التحقق بالبصمة",
    };
  }
}

/** `NotAllowedError` = user cancelled or the prompt timed out. */
export function isUserCancellation(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "NotAllowedError" || err.name === "AbortError")
  );
}

// ---------- disable / state ----------

export async function disableBiometric(): Promise<void> {
  await deleteMeta(CREDENTIAL_KEY);
  await deleteMeta(LAST_UNLOCK_KEY);
  markUnlocked(); // nothing left to lock against
}

export async function isBiometricEnabled(): Promise<boolean> {
  return Boolean(await getStoredCredentialId());
}

export async function getLastUnlockAt(): Promise<number | undefined> {
  return getMeta<number>(LAST_UNLOCK_KEY);
}
