import { afterEach, describe, expect, it, vi } from "vitest";
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  enrollBiometric,
  isBiometricSupported,
  isUnlockedThisSession,
  isUserCancellation,
  toBase64Url,
  unlockWithBiometric,
} from "../biometric";

vi.mock("../local-db", () => {
  const stored = new Map<string, unknown>();
  return {
    getMeta: vi.fn(async (key: string) => stored.get(key)),
    setMeta: vi.fn(async (key: string, value: unknown) => {
      stored.set(key, value);
    }),
    deleteMeta: vi.fn(async (key: string) => {
      stored.delete(key);
    }),
    __stored: stored,
  };
});

describe("bufferToBase64Url", () => {
  it("encodes an empty buffer to empty string", () => {
    expect(bufferToBase64Url(new ArrayBuffer(0))).toBe("");
  });

  it("encodes bytes without + / = characters", () => {
    const bytes = new Uint8Array([251, 255, 190, 190]);
    const out = bufferToBase64Url(bytes.buffer as ArrayBuffer);
    expect(out).not.toMatch(/[+/=]/);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("round-trips random buffers", () => {
    for (let i = 0; i < 20; i++) {
      const raw = crypto.getRandomValues(new Uint8Array(i + 1));
      const encoded = bufferToBase64Url(raw.buffer as ArrayBuffer);
      const decoded = base64UrlToBuffer(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(raw));
    }
  });
});

describe("base64UrlToBuffer", () => {
  it("decodes unpadded base64url", () => {
    // "hello" -> "aGVsbG8" in base64url without padding
    const buf = base64UrlToBuffer("aGVsbG8");
    expect(new TextDecoder().decode(buf)).toBe("hello");
  });

  it("round-trips arbitrary strings", () => {
    const s = "ab<>?&/#ر1-_.";
    const enc = bufferToBase64Url(
      new TextEncoder().encode(s).buffer as ArrayBuffer,
    );
    const dec = new TextDecoder().decode(base64UrlToBuffer(enc));
    expect(dec).toBe(s);
  });
});

describe("toBase64Url", () => {
  it("accepts Uint8Array directly", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const out = toBase64Url(bytes);
    expect(out).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlToBuffer(out))).toEqual([1, 2, 3]);
  });
});

describe("isUserCancellation", () => {
  it("detects NotAllowedError and AbortError", () => {
    expect(
      isUserCancellation(new DOMException("x", "NotAllowedError")),
    ).toBe(true);
    expect(isUserCancellation(new DOMException("x", "AbortError"))).toBe(
      true,
    );
  });

  it("rejects other DOMExceptions and non-DOM errors", () => {
    expect(isUserCancellation(new DOMException("x", "SecurityError"))).toBe(
      false,
    );
    expect(isUserCancellation(new Error("nope"))).toBe(false);
    expect(isUserCancellation("string")).toBe(false);
    expect(isUserCancellation(undefined)).toBe(false);
  });
});

describe("Android WebView bridge", () => {
  const g = globalThis as { window?: unknown };

  afterEach(() => {
    delete g.window;
  });

  /** Install a fake injected bridge that answers through the real callback. */
  function installBridge(behavior: (answer: (result: string) => void) => void) {
    g.window = {
      AndroidAuth: {
        isAvailable: () => true,
        verify: (requestId: string) =>
          behavior((result) =>
            (
              g.window as {
                __hadirBiometricResult?: (id: string, r: string) => void;
              }
            ).__hadirBiometricResult?.(requestId, result),
          ),
      },
    };
  }

  it("reports biometric support whenever the bridge is injected", () => {
    installBridge(() => {});
    expect(isBiometricSupported()).toBe(true);
  });

  it("stays unsupported without WebAuthn or the bridge", () => {
    g.window = {};
    expect(isBiometricSupported()).toBe(false);
  });

  it("enrolls through the native prompt and marks the session unlocked", async () => {
    installBridge((answer) => answer("ok"));
    const result = await enrollBiometric("مدير المدرسة");
    expect(result).toEqual({ ok: true });
    expect(isUnlockedThisSession()).toBe(true);
    const { getMeta } = await import("../local-db");
    await expect(getMeta("biometric.credentialId")).resolves.toMatch(
      /^android-native/,
    );
  });

  it("maps a native cancellation to a cancelled enrollment", async () => {
    installBridge((answer) => answer("cancelled"));
    const result = await enrollBiometric("مدير المدرسة");
    expect(result).toEqual({
      ok: false,
      reason: "cancelled",
      message: "تم إلغاء التسجيل",
    });
  });

  it("unlocks with a successful native verification", async () => {
    installBridge((answer) => answer("ok"));
    // Seed an enrollment marker the way enroll would have.
    const { setMeta } = await import("../local-db");
    await setMeta("biometric.credentialId", "android-native:1");
    const result = await unlockWithBiometric();
    expect(result).toEqual({ ok: true });
    expect(isUnlockedThisSession()).toBe(true);
  });

  it("reports failure when the native prompt errors", async () => {
    installBridge((answer) => answer("failed"));
    const { setMeta } = await import("../local-db");
    await setMeta("biometric.credentialId", "android-native:1");
    const result = await unlockWithBiometric();
    expect(result).toMatchObject({ ok: false, reason: "failed" });
  });
});
