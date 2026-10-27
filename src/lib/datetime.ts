/** Parse "HH:MM" -> minutes since midnight. Returns null when invalid. */
export function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Validate a "HH:MM" time string. */
export function isValidTime(value?: string | null): boolean {
  return parseTime(value) !== null;
}

/** Validate a "YYYY-MM-DD" date string. */
export function isValidDate(value?: string | null): boolean {
  if (!value) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
  );
  return (
    d.getFullYear() === Number(m[1]) &&
    d.getMonth() === Number(m[2]) - 1 &&
    d.getDate() === Number(m[3])
  );
}

/** Current local date key (YYYY-MM-DD). */
export function todayKey(): string {
  return dateKey(new Date());
}

/** Local date key for a Date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local now in HH:MM. */
export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Parse a date key back to a Date at local midnight. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const AR_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function arabicMonthName(month: number): string {
  return AR_MONTHS[month] ?? String(month);
}

export function arabicDayName(day: number): string {
  return AR_DAYS[day] ?? String(day);
}

/** "الأحد 17 سبتمبر 2026" style formatting. */
export function formatArabicDate(key: string): string {
  const d = keyToDate(key);
  return `${arabicDayName(d.getDay())} ${d.getDate()} ${arabicMonthName(
    d.getMonth(),
  )} ${d.getFullYear()}`;
}

/** "17/09/2026" numeric date. */
export function formatNumericDate(key: string): string {
  const d = keyToDate(key);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}

/** All YYYY-MM-DD keys in a month. */
export function monthDayKeys(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate();
  const keys: string[] = [];
  for (let i = 1; i <= days; i++) {
    keys.push(dateKey(new Date(year, month, i)));
  }
  return keys;
}

/** Days-in-month count. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
