import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { useApp } from "@/providers/app-provider";
import {
  arabicMonthName,
  formatNumericDate,
  monthDayKeys,
} from "@/lib/datetime";
import {
  EMPTY_STATS,
  attendanceRate,
  formatLateMinutes,
} from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/types";
import { formatPhoneDisplay, normalizePhone } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Phone, Pencil } from "lucide-react";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees, attendance } = useApp();
  const employee = employees.find((e) => e.id === id);
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthKeys = useMemo(() => new Set(monthDayKeys(year, month)), [year, month]);

  const records = useMemo(
    () =>
      attendance
        .filter((r) => r.employeeId === id && monthKeys.has(r.date))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [attendance, id, monthKeys],
  );

  const stats = useMemo(() => {
    const s = { ...EMPTY_STATS };
    for (const r of records) {
      s[r.status] += 1;
      s.total += 1;
    }
    return s;
  }, [records]);

  if (!employee) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold">الموظف غير موجود</p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => navigate("/app/employees")}
          >
            رجوع إلى الموظفين
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title={employee.name} subtitle={`${employee.position} • ${employee.category}`} />

      <section className="glass-strong space-y-3 rounded-3xl p-4">
        <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" dir="ltr">
          <Phone className="size-4 text-primary" />
          <span className="font-semibold">{formatPhoneDisplay(employee.phone)}</span>
        </div>
        {employee.notes && (
          <p className="text-xs leading-5 text-muted-foreground">
            📝 {employee.notes}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() =>
              navigate("/app/messages", { state: { employeeId: employee.id } })
            }
          >
            <Heart className="size-4 text-fuchsia-600" />
            رسالة شكر
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => {
              const wa = `https://wa.me/${normalizePhone(employee.phone)}`;
              window.open(wa, "_blank", "noopener,noreferrer");
              toast.success("تم فتح واتساب");
            }}
          >
            <Phone className="size-4 text-emerald-600 dark:text-emerald-400" />
            واتساب
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => navigate("/app/employees")}
            aria-label="تعديل"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </section>

      {/* Month switcher */}
      <section className="mt-3 flex items-center justify-between rounded-2xl glass px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label="الشهر السابق"
        >
          <ChevronRight className="size-4" />
        </Button>
        <p className="text-sm font-bold">
          {arabicMonthName(month)} {year}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
          aria-label="الشهر التالي"
          disabled={monthOffset >= 0}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </section>

      {/* Stats */}
      <section className="mt-3 grid grid-cols-4 gap-1.5">
        {(["present", "late", "absent", "permission"] as const).map((s) => (
          <div key={s} className="glass-chip rounded-2xl px-1 py-2.5 text-center">
            <p className="text-lg font-extrabold leading-none">{stats[s]}</p>
            <p className="mt-1 text-[9px] font-medium text-muted-foreground">
              {STATUS_LABELS[s]}
            </p>
          </div>
        ))}
      </section>
      <section className="glass mt-2 flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-semibold">
        <span>نسبة الحضور</span>
        <span className="text-primary">{attendanceRate(stats)}٪</span>
        <span>إجمالي التأخير</span>
        <span className="text-amber-700 dark:text-amber-300">
          {formatLateMinutes(stats.lateMinutes)}
        </span>
      </section>

      {/* History */}
      <section className="mt-3 space-y-2">
        {records.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-xs text-muted-foreground">
            لا توجد سجلات في هذا الشهر
          </div>
        ) : (
          records.map((r) => (
            <article
              key={r.id}
              className="glass flex items-center justify-between rounded-2xl px-3.5 py-2.5"
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {formatNumericDate(r.date)}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.time || "--"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                  r.status === "present" && "status-present",
                  r.status === "late" && "status-late",
                  r.status === "absent" && "status-absent",
                  r.status === "permission" && "status-permission",
                )}
              >
                {STATUS_LABELS[r.status]}
              </span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
