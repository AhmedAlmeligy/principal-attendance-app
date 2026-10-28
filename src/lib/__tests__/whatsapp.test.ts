import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  combinePhone,
  formatPhoneDisplay,
  isValidPhone,
  normalizePhone,
  splitPhone,
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

describe("splitPhone", () => {
  it("splits a stored international number into dial code + local part", () => {
    expect(splitPhone("96890010233")).toEqual({
      dial: "968",
      local: "90010233",
    });
    expect(splitPhone("+201012345678")).toEqual({
      dial: "20",
      local: "1012345678",
    });
    expect(splitPhone("00966501234567")).toEqual({
      dial: "966",
      local: "501234567",
    });
  });

  it("keeps historic local 0-numbers on the default country", () => {
    expect(splitPhone("07701234567")).toEqual({
      dial: "964",
      local: "07701234567",
    });
  });

  it("falls back to the default country for empty values", () => {
    expect(splitPhone("")).toEqual({ dial: "964", local: "" });
  });
});

describe("combinePhone", () => {
  it("prepends the dial code and drops national leading zeros", () => {
    expect(combinePhone("968", "90010233")).toBe("96890010233");
    expect(combinePhone("20", "01012345678")).toBe("201012345678");
    expect(combinePhone("964", "07701234567")).toBe("9647701234567");
  });

  it("ignores separators typed by the user", () => {
    expect(combinePhone("966", "50 123-4567")).toBe("966501234567");
  });

  it("produces a valid WhatsApp number from a picked country + local digits", () => {
    const phone = combinePhone("968", "90010233");
    expect(isValidPhone(phone)).toBe(true);
    expect(normalizePhone(phone)).toBe("96890010233");
  });
});

describe("formatPhoneDisplay", () => {
  it("renders valid numbers with a leading +", () => {
    expect(formatPhoneDisplay("07701234567")).toBe("+9647701234567");
    expect(formatPhoneDisplay("96890010233")).toBe("+96890010233");
  });

  it("keeps unusable values as typed", () => {
    expect(formatPhoneDisplay("123")).toBe("123");
    expect(formatPhoneDisplay("")).toBe("");
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
