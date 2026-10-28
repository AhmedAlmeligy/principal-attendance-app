import { COUNTRIES, DEFAULT_COUNTRY_DIAL } from "./countries";
import type { Employee } from "./types";

/**
 * Normalize a phone number for WhatsApp:
 * - strips spaces, dashes, parens
 * - converts 00 / 0 prefixes into international format when a default
 *   country code is provided (e.g. "964")
 */
export function normalizePhone(
  raw: string,
  defaultCountryCode = "964",
): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.slice(1);
  }
  return digits;
}

export function isValidPhone(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return /^\d{10,15}$/.test(normalized);
}

/**
 * Split a stored phone value into its country dial code and local digits so
 * the add/edit form can pre-select the country and show only the national
 * number. Handles +, 00 and 0 prefixes; falls back to the default country.
 */
export function splitPhone(raw: string): {
  dial: string;
  local: string;
} {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  if (!digits) return { dial: DEFAULT_COUNTRY_DIAL, local: "" };
  // National numbers kept in the app's historic local format (0-prefix).
  if (digits.startsWith("0")) {
    return { dial: DEFAULT_COUNTRY_DIAL, local: digits };
  }
  // Longest matching dial code wins (e.g. 1 vs 12, 964 vs 96).
  const match = COUNTRIES.filter((c) => digits.startsWith(c.dial))
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => digits.length - c.dial.length >= 6);
  if (match) {
    return { dial: match.dial, local: digits.slice(match.dial.length) };
  }
  return { dial: DEFAULT_COUNTRY_DIAL, local: digits };
}

/**
 * Combine a selected dial code with the locally typed digits into full
 * international digits (what gets stored). Leading zeros of the national
 * number are dropped — E.164 international format never carries them.
 */
export function combinePhone(dial: string, local: string): string {
  const localDigits = local.replace(/[^\d]/g, "").replace(/^0+/, "");
  return `${dial}${localDigits}`;
}

/** Display a stored number as "+96890010233", or the raw value if unusable. */
export function formatPhoneDisplay(raw: string): string {
  const normalized = normalizePhone(raw);
  return /^\d{10,15}$/.test(normalized) ? `+${normalized}` : raw;
}

/**
 * Build a wa.me deep link the principal reviews and presses send in —
 * WhatsApp never sends silently.
 */
export function buildWhatsAppLink(employee: Employee, message: string): string {
  const phone = normalizePhone(employee.phone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(employee: Employee, message: string): void {
  const url = buildWhatsAppLink(employee, message);
  window.open(url, "_blank", "noopener,noreferrer");
}
