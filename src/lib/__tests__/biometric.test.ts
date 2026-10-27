import { describe, expect, it } from "vitest";
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  isUserCancellation,
  toBase64Url,
} from "../biometric";

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
