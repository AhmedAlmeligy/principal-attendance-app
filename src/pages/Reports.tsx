import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { useApp } from "@/providers/app-provider";
import {
  arabicMonthName,
} from "@/lib/datetime";
import {
  buildMonthlyReport,
  attendanceRate,
  formatLateMinutes,
  EMPTY_STATS,
} from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/types";
import { captureEvent } from "@/lib/analytics";
import { getAndroidFiles } from "@/lib/android-bridge";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
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
  // PDF rendering happens on this thread and takes a moment — track which
  // action is running so the button shows a spinner and can't be double-tapped.
  const [exporting, setExporting] = useState<"download" | "share" | null>(null);

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

  const monthLabel = `${arabicMonthName(month)} ${year}`;
  const scopeLabel = selected ? selected.name : "كل الموظفين";
  const fileName = `تقرير-${year}-${String(month + 1).padStart(2, "0")}.pdf`;

  const makePdf = async () => {
    const { buildReportPdf } = await import("@/lib/pdf-report");
    return buildReportPdf({ report, settings, monthLabel, scopeLabel });
  };

  /**
   * Export the report as a real PDF: saved straight to Downloads inside the
   * Android app, or via a normal file download in the browser (which also
   * lets the user "Save as PDF").
   */
  const downloadReport = async () => {
    if (exporting) return;
    setExporting("download");
    try {
      const blob = await makePdf();
      const scope = selected ? "employee" : "all";
      const files = getAndroidFiles();
      if (files) {
        const { blobToBase64 } = await import("@/lib/pdf-report");
        files.savePdf(await blobToBase64(blob), fileName);
        captureEvent("report_exported", {
          scope,
          month: month + 1,
          year,
          method: "android_save",
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      captureEvent("report_exported", {
        scope,
        month: month + 1,
        year,
        method: "download",
      });
    } catch (err) {
      console.error("[reports] PDF export failed:", err);
      toast.error("تعذر إنشاء ملف PDF — حاول مجدداً");
    } finally {
      setExporting(null);
    }
  };

  /** Share the report as a PDF file (native sheet in the app and on mobile). */
  const shareReport = async () => {
    if (exporting) return;
    setExporting("share");
    const scope = selected ? "employee" : "all";
    try {
      const blob = await makePdf();
      const files = getAndroidFiles();
      if (files) {
        const { blobToBase64 } = await import("@/lib/pdf-report");
        files.sharePdf(await blobToBase64(blob), fileName);
        captureEvent("report_shared", { method: "android_share", scope });
        return;
      }
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `التقرير الشهري — ${settings.schoolName}`,
        });
        captureEvent("report_shared", { method: "native_share", scope });
        return;
      }
      // No file sharing here — save the PDF instead of copying plain text.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      captureEvent("report_shared", { method: "download", scope });
      toast.success("تم حفظ التقرير كملف PDF — شاركه من الملفات");
    } catch (err) {
      // The user dismissed the system share sheet.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[reports] PDF share failed:", err);
      toast.error("تعذّرت مشاركة التقرير — حاول مجدداً");
    } finally {
      setExporting(null);
    }
  };

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
            disabled={exporting !== null}
            onClick={() => void downloadReport()}
            aria-busy={exporting === "download"}
          >
            {exporting === "download" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exporting === "download" ? "جارٍ إنشاء PDF…" : "تحميل تقرير PDF"}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={exporting !== null}
            onClick={() => void shareReport()}
            aria-busy={exporting === "share"}
          >
            {exporting === "share" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Share2 className="size-4" />
            )}
            {exporting === "share" ? "جارٍ التجهيز…" : "مشاركة"}
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
    </div>
  );
}
