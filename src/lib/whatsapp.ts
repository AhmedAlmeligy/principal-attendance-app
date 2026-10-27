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
