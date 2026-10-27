import { describe, expect, it } from "vitest";
import {
  arabicDayName,
  arabicMonthName,
  dateKey,
  daysInMonth,
  formatArabicDate,
  formatNumericDate,
  isValidDate,
  isValidTime,
  keyToDate,
  monthDayKeys,
  nowTime,
  parseTime,
  todayKey,
} from "../datetime";

describe("parseTime", () => {
  it("parses valid HH:MM into minutes since midnight", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("08:05")).toBe(8 * 60 + 5);
    expect(parseTime("23:59")).toBe(23 * 60 + 59);
    expect(parseTime("8:15")).toBe(8 * 60 + 15); // single-digit hour
  });

  it("rejects malformed or out-of-range times", () => {
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("08:60")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime("08")).toBeNull();
    expect(parseTime("08:5")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
    expect(parseTime(null)).toBeNull();
  });
});

describe("isValidTime", () => {
  it("accepts valid times only", () => {
    expect(isValidTime("07:55")).toBe(true);
    expect(isValidTime("8:15")).toBe(true);
    expect(isValidTime("25:00")).toBe(false);
    expect(isValidTime("nope")).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
  });
});

describe("isValidDate", () => {
  it("accepts valid calendar dates", () => {
    expect(isValidDate("2026-09-17")).toBe(true);
    expect(isValidDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects invalid calendar dates and formats", () => {
    expect(isValidDate("2026-02-30")).toBe(false); // no Feb 30
    expect(isValidDate("2023-02-29")).toBe(false); // non-leap year
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-00-10")).toBe(false);
    expect(isValidDate("17/09/2026")).toBe(false);
    expect(isValidDate("2026-9-17")).toBe(false); // needs zero-padding
    expect(isValidDate("")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe("date key round-trips", () => {
  it("todayKey() returns a valid YYYY-MM-DD key", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidDate(todayKey())).toBe(true);
  });

  it("dateKey/keyToDate round-trip preserves the calendar day", () => {
    const d = new Date(2026, 8, 17); // Sep 17 2026, local
    const key = dateKey(d);
    expect(key).toBe("2026-09-17");
    const back = keyToDate(key);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(8);
    expect(back.getDate()).toBe(17);
  });

  it("nowTime() returns a valid HH:MM string", () => {
    expect(nowTime()).toMatch(/^\d{2}:\d{2}$/);
    expect(isValidTime(nowTime())).toBe(true);
  });
});

describe("monthDayKeys and daysInMonth", () => {
  it("returns all days of a month in order", () => {
    const keys = monthDayKeys(2026, 8); // September 2026
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-09-01");
    expect(keys[29]).toBe("2026-09-30");
  });

  it("handles February leap years", () => {
    expect(monthDayKeys(2024, 1)).toHaveLength(29);
    expect(monthDayKeys(2023, 1)).toHaveLength(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(31);
  });
});

describe("Arabic formatting", () => {
  it("formats numeric dates as DD/MM/YYYY", () => {
    expect(formatNumericDate("2026-09-17")).toBe("17/09/2026");
    expect(formatNumericDate("2026-01-05")).toBe("05/01/2026");
  });

  it("formats Arabic long dates with day and month names", () => {
    expect(formatArabicDate("2026-09-17")).toBe("الخميس 17 سبتمبر 2026");
  });

  it("exposes Arabic month and day names", () => {
    expect(arabicMonthName(0)).toBe("يناير");
    expect(arabicMonthName(11)).toBe("ديسمبر");
    expect(arabicDayName(4)).toBe("الخميس");
  });
});
