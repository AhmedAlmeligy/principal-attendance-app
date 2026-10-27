import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApp } from "@/providers/app-provider";
import { nowTime, isValidTime } from "@/lib/datetime";
import {
  APP_STATUS,
  STATUS_LABELS,
  type AttendanceStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ORDER: AttendanceStatus[] = [
  APP_STATUS.present,
  APP_STATUS.late,
  APP_STATUS.absent,
  APP_STATUS.permission,
];

const STATUS_BTN: Record<
  AttendanceStatus,
  { active: string; idle: string }
> = {
  present: {
    active: "status-present border shadow-sm font-bold",
    idle: "glass-chip text-muted-foreground",
  },
  late: {
    active: "status-late border shadow-sm font-bold",
    idle: "glass-chip text-muted-foreground",
  },
  absent: {
    active: "status-absent border shadow-sm font-bold",
    idle: "glass-chip text-muted-foreground",
  },
  permission: {
    active: "status-permission border shadow-sm font-bold",
    idle: "glass-chip text-muted-foreground",
  },
};

export function StatusButtons({
  employeeId,
  employeeName,
  date,
  currentStatus,
  currentTime,
  onSaved,
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  currentStatus?: AttendanceStatus;
  currentTime?: string;
  onSaved?: () => void;
}) {
  const { recordAttendance, settings } = useApp();
  const [saving, setSaving] = useState<AttendanceStatus | null>(null);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [pending, setPending] = useState<{
    status: AttendanceStatus;
    time: string;
  } | null>(null);

  // No await needed: optimistic local write first, background sync after
  const save = async (status: AttendanceStatus, time?: string) => {
    setSaving(status);
    try {
      await recordAttendance({
        employeeId,
        employeeName,
        date,
        time,
        status,
      });
      toast.success(`${employeeName}: ${STATUS_LABELS[status]} ✓`, {
        duration: 1600,
      });
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ، حاول مجدداً");
    } finally {
      setSaving(null);
    }
  };

  const handleSelect = (status: AttendanceStatus) => {
    if (status === "present" || status === "late") {
      const suggested =
        status === "present"
          ? currentTime || nowTime()
          : currentTime || settings.lateThreshold;
      setPending({ status, time: suggested });
      setTimeSheetOpen(true);
      return;
    }
    void save(status, undefined);
  };

  const confirmTime = () => {
    if (!pending) return;
    if (!isValidTime(pending.time)) {
      toast.error("وقت غير صالح — استخدم صيغة HH:MM");
      return;
    }
    const { status, time } = pending;
    setTimeSheetOpen(false);
    setPending(null);
    void save(status, time);
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {ORDER.map((status) => {
          const isActive = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={saving !== null}
              onClick={() => handleSelect(status)}
              className={cn(
                "min-h-11 rounded-xl px-1 py-2 text-xs transition-all active:scale-95 disabled:opacity-60",
                isActive
                  ? STATUS_BTN[status].active
                  : STATUS_BTN[status].idle,
              )}
            >
              {saving === status ? (
                <Loader2 className="mx-auto size-4 animate-spin" />
              ) : (
                STATUS_LABELS[status]
              )}
            </button>
          );
        })}
      </div>

      <Sheet open={timeSheetOpen} onOpenChange={setTimeSheetOpen}>
        <SheetContent side="bottom" className="glass-strong rounded-t-3xl">
          <SheetHeader className="text-right">
            <SheetTitle>
              وقت الحضور — {employeeName}
            </SheetTitle>
          </SheetHeader>
          {pending && (
            <div className="space-y-4 px-4 pb-8">
              <div className="glass-chip flex items-center gap-2 rounded-xl px-3 py-2.5">
                <Clock className="size-4 text-primary" />
                <Input
                  type="time"
                  value={pending.time}
                  onChange={(e) =>
                    setPending({ ...pending, time: e.target.value })
                  }
                  className="border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                الوصول بعد {settings.lateThreshold} يُسجَّل تأخيراً تلقائياً عند
                اختيار «تأخير».
              </p>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-xl" onClick={confirmTime}>
                  <Save className="size-4" />
                  حفظ
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setTimeSheetOpen(false);
                    setPending(null);
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
