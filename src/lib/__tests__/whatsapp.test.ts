import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  isValidPhone,
  normalizePhone,
} from "../whatsapp";
import type { Employee } from "../types";

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    name: "أحمد محمد",
    phone: "07701234567",
    position: "مدرس",
    category: "تدريسي",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("normalizePhone", () => {
  it("converts local 0-prefix numbers using the default country code", () => {
    expect(normalizePhone("07701234567")).toBe("9647701234567");
    expect(normalizePhone("0770 123 4567")).toBe("9647701234567");
  });

  it("supports a custom country code", () => {
    expect(normalizePhone("0501234567", "966")).toBe("966501234567");
  });

  it("keeps already-international numbers", () => {
    expect(normalizePhone("9647701234567")).toBe("9647701234567");
    expect(normalizePhone("+9647701234567")).toBe("9647701234567");
    expect(normalizePhone("009647701234567")).toBe("9647701234567");
  });

  it("strips separators and other non-digit characters", () => {
    expect(normalizePhone("+964 (770) 123-4567")).toBe("9647701234567");
    expect(normalizePhone(" 0770-123-4567 ")).toBe("9647701234567");
  });

  it("passes through numbers without a recognized prefix", () => {
    expect(normalizePhone("1234567890")).toBe("1234567890");
  });
});

describe("isValidPhone", () => {
  it("accepts valid local and international numbers", () => {
    expect(isValidPhone("07701234567")).toBe(true);
    expect(isValidPhone("+9647701234567")).toBe(true);
    expect(isValidPhone("9647701234567")).toBe(true);
    expect(isValidPhone("1234567890")).toBe(true); // 10 digits
  });

  it("rejects numbers that are too short, too long, or non-numeric", () => {
    expect(isValidPhone("0770")).toBe(false);
    expect(isValidPhone("123456789")).toBe(false); // 9 digits
    expect(isValidPhone("1234567890123456")).toBe(false); // 16 digits
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("not-a-number")).toBe(false);
  });
});

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with normalized phone and encoded message", () => {
    const link = buildWhatsAppLink(
      makeEmployee({ phone: "07701234567" }),
      "شكراً لجهودك والتزامك.",
    );
    expect(link).toMatch(/^https:\/\/wa\.me\/9647701234567\?text=/);
    // Message survives URL encoding round-trip
    const text = decodeURIComponent(link.split("text=")[1]!);
    expect(text).toBe("شكراً لجهودك والتزامك.");
  });

  it("encodes newlines and special characters safely", () => {
    const link = buildWhatsAppLink(
      makeEmployee({ phone: "+9647701234567" }),
      "سطر أول\nسطر ثاني & 100%",
    );
    expect(link).not.toContain("\n");
    expect(link).not.toContain(" ");
    const text = decodeURIComponent(link.split("text=")[1]!);
    expect(text).toBe("سطر أول\nسطر ثاني & 100%");
  });
});
