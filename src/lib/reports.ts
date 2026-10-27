import {
  arabicMonthName,
  dateKey,
  formatNumericDate,
  monthDayKeys,
  parseTime,
} from "./datetime";
import {
  AttendanceRecord,
  AttendanceStatus,
  AppSettings,
  Employee,
} from "./types";

export interface EmployeeMonthlyStats {
  present: number;
  late: number;
  absent: number;
  permission: number;
  total: number;
  lateMinutes: number;
}

export interface ReportRow {
  employeeId: string;
  employeeName: string;
  rawDate: string; // YYYY-MM-DD
  date: string; // formatted DD/MM/YYYY
  time: string;
  status: AttendanceStatus;
}

export const EMPTY_STATS: EmployeeMonthlyStats = {
  present: 0,
  late: 0,
  absent: 0,
  permission: 0,
  total: 0,
  lateMinutes: 0,
};

export function attendanceRate(stats: EmployeeMonthlyStats): number {
  const attended = stats.present + stats.late;
  if (stats.total === 0) return 0;
  return Math.round((attended / stats.total) * 100);
}

export function formatLateMinutes(minutes: number): string {
  if (minutes <= 0) return "لا يوجد";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h} س ${m} د` : `${h} ساعة`;
  return `${m} دقيقة`;
}

export interface MonthlyReport {
  month: number;
  year: number;
  employees: Employee[];
  records: AttendanceRecord[];
  perEmployee: Map<string, EmployeeMonthlyStats>;
  rows: ReportRow[];
  totals: EmployeeMonthlyStats;
}

export function buildMonthlyReport(
  year: number,
  month: number,
  employees: Employee[],
  records: AttendanceRecord[],
  settings: AppSettings,
): MonthlyReport {
  const monthKeys = new Set(monthDayKeys(year, month));
  const monthRecords = records
    .filter((r) => monthKeys.has(r.date))
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  const employeeIds = new Set(employees.map((e) => e.id));
  const perEmployee = new Map<string, EmployeeMonthlyStats>();
  const rows: ReportRow[] = [];

  const baseArrival =
    parseTime(settings.defaultArrivalTime) ?? 8 * 60;

  for (const r of monthRecords) {
    if (!employeeIds.has(r.employeeId)) continue;
    const stats = perEmployee.get(r.employeeId) ?? { ...EMPTY_STATS };
    stats[r.status] += 1;
    stats.total += 1;
    if (r.status === "late" && r.time) {
      const arrival = parseTime(r.time);
      if (arrival !== null && arrival > baseArrival) {
        stats.lateMinutes += arrival - baseArrival;
      }
    }
    perEmployee.set(r.employeeId, stats);
    rows.push({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      rawDate: r.date,
      date: formatNumericDate(r.date),
      time: r.time || "--",
      status: r.status,
    });
  }

  const totals = { ...EMPTY_STATS };
  for (const s of perEmployee.values()) {
    totals.present += s.present;
    totals.late += s.late;
    totals.absent += s.absent;
    totals.permission += s.permission;
    totals.total += s.total;
    totals.lateMinutes += s.lateMinutes;
  }

  return {
    month,
    year,
    employees,
    records: monthRecords,
    perEmployee,
    rows,
    totals,
  };
}

/** Human-readable Arabic summary of a report (used for share sheet). */
export function buildReportText(
  report: MonthlyReport,
  settings: AppSettings,
): string {
  const lines: string[] = [];
  lines.push(`🏫 ${settings.schoolName}`);
  lines.push(
    `📊 التقرير الشهري — ${arabicMonthName(report.month)} ${report.year}`,
  );
  lines.push("────────────────────");
  for (const e of report.employees) {
    const s = report.perEmployee.get(e.id) ?? EMPTY_STATS;
    lines.push("");
    lines.push(`👤 ${e.name} (${e.position})`);
    lines.push(
      `✅ حضور: ${s.present} | ⏰ تأخير: ${s.late} | ❌ غياب: ${s.absent} | 📝 مأذونية: ${s.permission}`,
    );
    lines.push(`📈 نسبة الحضور: ${attendanceRate(s)}٪`);
    lines.push(`⏱ إجمالي التأخير: ${formatLateMinutes(s.lateMinutes)}`);
  }
  lines.push("");
  lines.push("────────────────────");
  lines.push(
    `إجمالي: حضور ${report.totals.present} | تأخير ${report.totals.late} | غياب ${report.totals.absent} | مأذونية ${report.totals.permission}`,
  );
  lines.push(`🗓 تاريخ الإنشاء: ${formatNumericDate(dateKey(new Date()))}`);
  lines.push(`✍️ ${settings.principalName} — ${settings.schoolName}`);
  return lines.join("\n");
}
