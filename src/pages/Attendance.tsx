import { AppHeader } from "@/components/app/AppHeader";
import {
  StatusButtons,
} from "@/components/app/StatusButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/providers/app-provider";
import {
  dateKey,
  formatArabicDate,
  todayKey,
} from "@/lib/datetime";
import { STATUS_LABELS, type AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Attendance() {
  const { employees, attendance, settings, recordAttendance, refresh } =
    useApp();
  const [date, setDate] = useState(todayKey());
  const [search, setSearch] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  const todaysRecords = useMemo(
    () => attendance.filter((r) => r.date === date),
    [attendance, date],
  );

  const byEmployee = useMemo(() => {
    const map = new Map<string, (typeof todaysRecords)[number]>();
    for (const r of todaysRecords) map.set(r.employeeId, r);
    return map;
  }, [todaysRecords]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name.includes(q) || e.position.includes(q),
    );
  }, [employees, search]);

  const shiftDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(dateKey(d));
  };

  const markAll = async (status: AttendanceStatus) => {
    if (filtered.length === 0) return;
    setSavingAll(true);
    try {
      for (const e of filtered) {
        await recordAttendance({
          employeeId: e.id,
          employeeName: e.name,
          date,
          time:
            status === "present"
              ? settings.defaultArrivalTime
              : status === "late"
                ? settings.lateThreshold
                : undefined,
          status,
        });
      }
      await refresh();
      toast.success(
        `تم تسجيل ${STATUS_LABELS[status]} لـ ${filtered.length} موظف`,
      );
    } finally {
      setSavingAll(false);
    }
  };

  const recordedCount = todaysRecords.length;
  const progress = employees.length
    ? Math.round((recordedCount / employees.length) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="الحضور والغياب" subtitle={formatArabicDate(date)} />

      {/* Date selector + search */}
      <section className="glass-strong space-y-2.5 rounded-3xl p-3.5">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="glass-chip size-9 shrink-0 rounded-full"
            onClick={() => shiftDate(-1)}
            aria-label="اليوم السابق"
          >
            <ChevronRight className="size-4" />
          </Button>
          <label className="glass-chip flex flex-1 items-center gap-2 rounded-xl px-3 py-2">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(
                  /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)
                    ? e.target.value
                    : date,
                )
              }
              className="w-full bg-transparent text-sm font-semibold outline-none"
            />
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="glass-chip size-9 shrink-0 rounded-full"
            onClick={() => shiftDate(1)}
            aria-label="اليوم التالي"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>

        <label className="glass-chip flex items-center gap-2 rounded-xl px-3 py-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن موظف…"
            className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </label>

        {/* Quick mark all */}
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Zap className="size-3.5 text-amber-500 dark:text-amber-300" />
            تسجيل الجميع:
          </span>
          {(["present", "late", "absent", "permission"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={savingAll || filtered.length === 0}
              onClick={() => void markAll(s)}
              className="glass-chip min-h-9 flex-1 rounded-lg text-[11px] font-bold text-muted-foreground transition-all active:scale-95 disabled:opacity-50"
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
            <span>
              تم تسجيل {recordedCount} من {employees.length}
            </span>
            <span>{progress}٪</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/50">
            <div
              className="h-full rounded-full bg-primary/70 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Employee list */}
      <section className="mt-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold">لا يوجد موظفون</p>
            <p className="mt-1 text-xs text-muted-foreground">
              أضف موظفين من قسم «الموظفين» لتبدأ تسجيل الحضور
            </p>
          </div>
        ) : (
          filtered.map((e) => {
            const rec = byEmployee.get(e.id);
            return (
              <article
                key={e.id}
                className="glass-tile rounded-2xl p-3.5"
              >
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{e.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {e.position}
                      {e.category ? ` • ${e.category}` : ""}
                    </p>
                  </div>
                  {rec && (
                    <span
                      className={cn(
                        "glass-chip shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                        rec.status === "present" && "status-present",
                        rec.status === "late" && "status-late",
                        rec.status === "absent" && "status-absent",
                        rec.status === "permission" && "status-permission",
                      )}
                    >
                      {STATUS_LABELS[rec.status]}
                      {rec.time ? ` ${rec.time}` : ""}
                    </span>
                  )}
                </div>
                <StatusButtons
                  employeeId={e.id}
                  employeeName={e.name}
                  date={date}
                  currentStatus={rec?.status}
                  currentTime={rec?.time}
                />
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
