import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { useApp } from "@/providers/app-provider";
import { formatArabicDate, todayKey, arabicDayName } from "@/lib/datetime";
import { STATUS_LABELS } from "@/lib/types";
import {
  BarChart3,
  CalendarCheck2,
  Heart,
  Settings,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

export default function Home() {
  const { employees, attendance, settings } = useApp();
  const navigate = useNavigate();
  const today = todayKey();

  const todays = attendance.filter((r) => r.date === today);
  const count = (s: string) => todays.filter((r) => r.status === s).length;
  const present = count("present");
  const late = count("late");
  const absent = count("absent");
  const permission = count("permission");
  const recorded = todays.length;
  const remaining = Math.max(0, employees.length - recorded);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "صباح الخير"
      : hour < 17
        ? "طاب يومك"
        : "مساء الخير";

  const sections = [
    {
      path: "/app/attendance",
      title: "الحضور والغياب",
      desc: "تسجيل سريع لليوم",
      icon: CalendarCheck2,
      tint: "text-primary",
    },
    {
      path: "/app/employees",
      title: "الموظفين",
      desc: "إدارة بيانات الموظفين",
      icon: Users,
      tint: "text-chart-2",
    },
    {
      path: "/app/reports",
      title: "التقرير الشهري",
      desc: "إحصائيات وتقرير PDF",
      icon: BarChart3,
      tint: "text-chart-3",
    },
    {
      path: "/app/messages",
      title: "رسائل الشكر والتقدير",
      desc: "إرسال عبر واتساب",
      icon: Heart,
      tint: "text-chart-5",
    },
    {
      path: "/app/settings",
      title: "الإعدادات",
      desc: "المدرسة وأوقات الدوام",
      icon: Settings,
      tint: "text-chart-4",
    },
  ];

  const stats = [
    { label: "الموظفين", value: employees.length, cls: "text-foreground" },
    { label: "حاضر اليوم", value: present, cls: "dark:text-emerald-300 text-emerald-700" },
    { label: "متأخر اليوم", value: late, cls: "dark:text-amber-300 text-amber-700" },
    { label: "غائب اليوم", value: absent, cls: "dark:text-red-300 text-red-700" },
    { label: "مأذونيات اليوم", value: permission, cls: "dark:text-fuchsia-300 text-fuchsia-700" },
  ];

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader
        title={`${greeting} 👋`}
        subtitle={formatArabicDate(today)}
      />

      {/* Hero stats */}
      <section className="glass-strong rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{settings.schoolName}</p>
            <p className="text-[11px] text-muted-foreground">
              {arabicDayName(new Date().getDay())} — {remaining > 0 ? `${remaining} موظف لم يُسجل بعد` : "تم تسجيل الجميع 🎉"}
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => navigate("/app/attendance")}
          >
            <CalendarCheck2 className="size-4" />
            تسجيل الحضور
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass-chip rounded-2xl px-1 py-2.5 text-center"
            >
              <p className={cn("text-lg font-extrabold leading-none", s.cls)}>
                {s.value}
              </p>
              <p className="mt-1 text-[9px] font-medium leading-tight text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Today breakdown */}
      {recorded > 0 && (
        <section className="glass mt-3 flex items-center justify-between rounded-2xl px-4 py-3 text-xs">
          <span className="font-semibold text-muted-foreground">
            حصة اليوم
          </span>
          <span className="flex gap-3 font-semibold">
            <span className="dark:text-emerald-300 text-emerald-700">
              {STATUS_LABELS.present} {present}
            </span>
            <span className="dark:text-amber-300 text-amber-700">
              {STATUS_LABELS.late} {late}
            </span>
            <span className="dark:text-red-300 text-red-700">
              {STATUS_LABELS.absent} {absent}
            </span>
            <span className="dark:text-fuchsia-300 text-fuchsia-700">
              {STATUS_LABELS.permission} {permission}
            </span>
          </span>
        </section>
      )}

      {/* Sections */}
      <section className="mt-3 grid grid-cols-1 gap-2.5">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.path}
              type="button"
              onClick={() => navigate(s.path)}
              className="glass-tile flex items-center gap-3 rounded-2xl p-3.5 text-right"
            >
              <span
                className={cn(
                  "glass-chip flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  s.tint,
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{s.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {s.desc}
                </span>
              </span>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </section>
    </div>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
