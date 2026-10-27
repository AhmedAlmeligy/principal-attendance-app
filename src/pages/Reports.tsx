import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { useApp } from "@/providers/app-provider";
import {
  arabicMonthName,
  formatNumericDate,
  todayKey,
} from "@/lib/datetime";
import {
  buildMonthlyReport,
  attendanceRate,
  formatLateMinutes,
  EMPTY_STATS,
} from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Share2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Reports() {
  const { employees, attendance, settings } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employeeId, setEmployeeId] = useState<string>("all");

  const selected = employees.find((e) => e.id === employeeId);
  const scope = useMemo(
    () => (selected ? [selected] : employees),
    [selected, employees],
  );

  const report = useMemo(
    () => buildMonthlyReport(year, month, scope, attendance, settings),
    [year, month, scope, attendance, settings],
  );

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const shareReport = async () => {
    const { buildReportText } = await import("@/lib/reports");
    const text = buildReportText(report, settings);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `التقرير الشهري — ${settings.schoolName}`,
          text,
        });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard?.writeText(text);
    toast.success("تم نسخ التقرير إلى الحافظة");
  };

  const monthLabel = `${arabicMonthName(month)} ${year}`;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="التقرير الشهري" subtitle={monthLabel} />

      {/* Controls */}
      <section className="glass-strong space-y-2.5 rounded-3xl p-3.5">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="glass-chip size-9 rounded-full"
            onClick={() => shiftMonth(-1)}
            aria-label="الشهر السابق"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="glass-chip rounded-xl px-3 py-2 text-sm font-semibold outline-none"
              aria-label="الشهر"
            >
              {Array.from({ length: 12 }).map((_, m) => (
                <option key={m} value={m}>
                  {arabicMonthName(m)}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="glass-chip rounded-xl px-3 py-2 text-sm font-semibold outline-none"
              aria-label="السنة"
            >
              {[year - 2, year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="glass-chip size-9 rounded-full"
            onClick={() => shiftMonth(1)}
            aria-label="الشهر التالي"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="glass-chip w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
          aria-label="الموظف"
        >
          <option value="all">كل الموظفين</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            إنشاء تقرير PDF
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void shareReport()}
          >
            <Share2 className="size-4" />
            مشاركة
          </Button>
        </div>
      </section>

      {/* Stats summary */}
      {scope.length > 0 ? (
        <section className="mt-3 grid grid-cols-4 gap-1.5">
          {(["present", "late", "absent", "permission"] as const).map((s) => (
            <div
              key={s}
              className="glass-chip rounded-2xl px-1 py-2.5 text-center"
            >
              <p className="text-lg font-extrabold leading-none">
                {report.totals[s]}
              </p>
              <p className="mt-1 text-[9px] font-medium text-muted-foreground">
                {STATUS_LABELS[s]}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {/* Per-employee stats */}
      {report.employees.length > 1 && (
        <section className="mt-3 space-y-2">
          {report.employees.map((e) => {
            const s = report.perEmployee.get(e.id) ?? EMPTY_STATS;
            return (
              <article
                key={e.id}
                className="glass-tile flex items-center justify-between rounded-2xl px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {STATUS_LABELS.present} {s.present} • {STATUS_LABELS.late}{" "}
                    {s.late} • {STATUS_LABELS.absent} {s.absent} •{" "}
                    {STATUS_LABELS.permission} {s.permission}
                  </p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-sm font-extrabold text-primary">
                    {attendanceRate(s)}٪
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {formatLateMinutes(s.lateMinutes)}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Hidden print sheet — real printable document */}
      <div id="print-root" className="hidden print:block">
        <PrintableReport
          report={report}
          settings={settings}
          monthLabel={monthLabel}
          scopeLabel={selected ? selected.name : "كل الموظفين"}
        />
      </div>
    </div>
  );
}

function PrintableReport({
  report,
  settings,
  monthLabel,
  scopeLabel,
}: {
  report: ReturnType<typeof buildMonthlyReport>;
  settings: { schoolName: string; principalName: string; reportFooterNote?: string };
  monthLabel: string;
  scopeLabel: string;
}) {
  return (
    <div className="bg-white p-6 text-black" dir="rtl">
      <header className="mb-4 border-b-2 border-black/80 pb-3 text-center">
        <h1 className="text-xl font-extrabold">{settings.schoolName}</h1>
        <p className="mt-1 text-sm font-bold">
          التقرير الشهري للحضور والغياب — {monthLabel}
        </p>
        <p className="mt-0.5 text-xs">النطاق: {scopeLabel}</p>
      </header>

      {/* Detailed rows */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-black/70 bg-black/5 text-[11px]">
            <th className="border border-black/40 px-2 py-1.5 text-right">اسم الموظف</th>
            <th className="border border-black/40 px-2 py-1.5">التاريخ</th>
            <th className="border border-black/40 px-2 py-1.5">الوقت</th>
            <th className="border border-black/40 px-2 py-1.5">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="border border-black/40 px-2 py-3 text-center">
                لا توجد سجلات لهذا الشهر
              </td>
            </tr>
          ) : (
            report.rows.map((r, i) => (
              <tr key={i} className="border-b border-black/20">
                <td className="border border-black/40 px-2 py-1 text-right">{r.employeeName}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{r.date}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{r.time}</td>
                <td className="border border-black/40 px-2 py-1 text-center font-bold">
                  {STATUS_LABELS[r.status]}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Stats per employee */}
      <h2 className="mt-5 mb-2 text-sm font-extrabold">الإحصائيات الشهرية</h2>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-black/70 bg-black/5">
            <th className="border border-black/40 px-2 py-1.5 text-right">الموظف</th>
            <th className="border border-black/40 px-2 py-1.5">حضور</th>
            <th className="border border-black/40 px-2 py-1.5">تأخير</th>
            <th className="border border-black/40 px-2 py-1.5">غياب</th>
            <th className="border border-black/40 px-2 py-1.5">مأذونية</th>
            <th className="border border-black/40 px-2 py-1.5">نسبة الحضور</th>
            <th className="border border-black/40 px-2 py-1.5">إجمالي التأخير</th>
          </tr>
        </thead>
        <tbody>
          {report.employees.map((e) => {
            const s = report.perEmployee.get(e.id) ?? EMPTY_STATS;
            return (
              <tr key={e.id} className="border-b border-black/20">
                <td className="border border-black/40 px-2 py-1 text-right font-semibold">{e.name}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{s.present}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{s.late}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{s.absent}</td>
                <td className="border border-black/40 px-2 py-1 text-center">{s.permission}</td>
                <td className="border border-black/40 px-2 py-1 text-center font-bold">{attendanceRate(s)}٪</td>
                <td className="border border-black/40 px-2 py-1 text-center">{formatLateMinutes(s.lateMinutes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="mt-6 flex items-end justify-between text-xs">
        <div>
          <p>تاريخ الإنشاء: {formatNumericDate(todayKey())}</p>
          {settings.reportFooterNote && (
            <p className="mt-1 text-[10px] text-black/60">
              {settings.reportFooterNote}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="font-bold">{settings.principalName}</p>
          <p className="mt-8 border-t border-black/60 pt-1">توقيع مدير المدرسة</p>
        </div>
      </footer>
    </div>
  );
}
