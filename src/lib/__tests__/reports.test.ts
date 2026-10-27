import { describe, expect, it } from "vitest";
import {
  buildMonthlyReport,
  attendanceRate,
  formatLateMinutes,
  EMPTY_STATS,
} from "../reports";
import type { AttendanceRecord, AppSettings, Employee } from "../types";

const SETTINGS: AppSettings = {
  schoolName: "مدرسة الاختبار",
  principalName: "المدير",
  defaultArrivalTime: "08:00",
  lateThreshold: "08:15",
  workingDays: [0, 1, 2, 3, 4],
};

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

function makeRecord(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: "att-1",
    employeeId: "emp-1",
    employeeName: "أحمد محمد",
    date: "2026-09-01",
    status: "present",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("attendanceRate", () => {
  it("counts present + late as attended", () => {
    expect(
      attendanceRate({ ...EMPTY_STATS, present: 7, late: 3, total: 10 }),
    ).toBe(100);
    expect(
      attendanceRate({ ...EMPTY_STATS, present: 6, late: 2, absent: 2, total: 10 }),
    ).toBe(80);
    expect(
      attendanceRate({
        ...EMPTY_STATS,
        present: 5,
        late: 2,
        absent: 2,
        permission: 1,
        total: 10,
      }),
    ).toBe(70);
  });

  it("returns 0 for empty stats", () => {
    expect(attendanceRate(EMPTY_STATS)).toBe(0);
  });
});

describe("formatLateMinutes", () => {
  it("formats minutes, hours, and mixed durations in Arabic", () => {
    expect(formatLateMinutes(0)).toBe("لا يوجد");
    expect(formatLateMinutes(-5)).toBe("لا يوجد");
    expect(formatLateMinutes(5)).toBe("5 دقيقة");
    expect(formatLateMinutes(45)).toBe("45 دقيقة");
    expect(formatLateMinutes(60)).toBe("1 ساعة");
    expect(formatLateMinutes(75)).toBe("1 س 15 د");
    expect(formatLateMinutes(130)).toBe("2 س 10 د");
  });
});

describe("buildMonthlyReport", () => {
  it("keeps only records inside the selected month", () => {
    const report = buildMonthlyReport(
      2026,
      8, // September
      [makeEmployee()],
      [
        makeRecord({ date: "2026-09-01" }),
        makeRecord({ date: "2026-09-30" }),
        makeRecord({ date: "2026-08-31" }), // previous month — excluded
        makeRecord({ date: "2026-10-01" }), // next month — excluded
      ],
      SETTINGS,
    );
    expect(report.records).toHaveLength(2);
    expect(report.rows).toHaveLength(2);
    expect(report.totals.total).toBe(2);
  });

  it("keeps only records for the selected employees", () => {
    const empA = makeEmployee({ id: "a", name: "أ" });
    const report = buildMonthlyReport(
      2026,
      8,
      [empA], // only A in scope
      [
        makeRecord({ employeeId: "a", date: "2026-09-02" }),
        makeRecord({ employeeId: "b", date: "2026-09-02" }), // out of scope
      ],
      SETTINGS,
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].employeeId).toBe("a");
    expect(report.totals.total).toBe(1);
  });

  it("accumulates per-status counts per employee", () => {
    const emp = makeEmployee();
    const report = buildMonthlyReport(
      2026,
      8,
      [emp],
      [
        makeRecord({ date: "2026-09-01", status: "present" }),
        makeRecord({ date: "2026-09-02", status: "present" }),
        makeRecord({ date: "2026-09-03", status: "late", time: "08:20" }),
        makeRecord({ date: "2026-09-04", status: "absent" }),
        makeRecord({ date: "2026-09-07", status: "permission" }),
      ],
      SETTINGS,
    );
    const s = report.perEmployee.get(emp.id)!;
    expect(s.present).toBe(2);
    expect(s.late).toBe(1);
    expect(s.absent).toBe(1);
    expect(s.permission).toBe(1);
    expect(s.total).toBe(5);
  });

  it("sums late minutes beyond the official arrival time", () => {
    const emp = makeEmployee();
    const report = buildMonthlyReport(
      2026,
      8,
      [emp],
      [
        // arrival 08:20 => 20 minutes late (base 08:00)
        makeRecord({ date: "2026-09-01", status: "late", time: "08:20" }),
        // arrival 08:05 => 5 minutes late
        makeRecord({ date: "2026-09-02", status: "late", time: "08:05" }),
        // marked late but before base arrival — adds nothing
        makeRecord({ date: "2026-09-03", status: "late", time: "07:50" }),
        // late with no recorded time — adds nothing
        makeRecord({ date: "2026-09-04", status: "late" }),
        // present, not late — adds nothing
        makeRecord({ date: "2026-09-07", status: "present", time: "07:55" }),
      ],
      SETTINGS,
    );
    const s = report.perEmployee.get(emp.id)!;
    expect(s.late).toBe(4);
    expect(s.lateMinutes).toBe(25); // 20 + 5
  });

  it("aggregates totals across multiple employees", () => {
    const a = makeEmployee({ id: "a" });
    const b = makeEmployee({ id: "b" });
    const report = buildMonthlyReport(
      2026,
      8,
      [a, b],
      [
        makeRecord({ employeeId: "a", date: "2026-09-01", status: "present" }),
        makeRecord({ employeeId: "a", date: "2026-09-02", status: "late", time: "08:30" }),
        makeRecord({ employeeId: "b", date: "2026-09-01", status: "absent" }),
        makeRecord({ employeeId: "b", date: "2026-09-02", status: "permission" }),
      ],
      SETTINGS,
    );
    expect(report.totals).toMatchObject({
      present: 1,
      late: 1,
      absent: 1,
      permission: 1,
      total: 4,
      lateMinutes: 30,
    });
  });

  it("formats rows with numeric date, time fallback and status label", () => {
    const report = buildMonthlyReport(
      2026,
      8,
      [makeEmployee()],
      [
        makeRecord({ date: "2026-09-15", status: "present", time: "07:55" }),
        makeRecord({ date: "2026-09-16", status: "absent" }),
      ],
      SETTINGS,
    );
    const [first, second] = report.rows;
    expect(first.date).toBe("15/09/2026");
    expect(first.time).toBe("07:55");
    expect(first.status).toBe("present");
    expect(second.time).toBe("--"); // no time recorded
    expect(second.status).toBe("absent");
  });

  it("sorts rows by date ascending", () => {
    const report = buildMonthlyReport(
      2026,
      8,
      [makeEmployee()],
      [
        makeRecord({ date: "2026-09-10", status: "present" }),
        makeRecord({ date: "2026-09-02", status: "present" }),
        makeRecord({ date: "2026-09-20", status: "present" }),
      ],
      SETTINGS,
    );
    expect(report.rows.map((r) => r.rawDate)).toEqual([
      "2026-09-02",
      "2026-09-10",
      "2026-09-20",
    ]);
  });

  it("handles an empty month gracefully", () => {
    const report = buildMonthlyReport(2026, 8, [makeEmployee()], [], SETTINGS);
    expect(report.rows).toHaveLength(0);
    expect(report.totals.total).toBe(0);
    expect(report.totals.lateMinutes).toBe(0);
  });
});
