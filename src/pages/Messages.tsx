import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useApp } from "@/providers/app-provider";
import { THANK_YOU_PRESETS } from "@/lib/types";
import { openWhatsApp, isValidPhone } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Heart, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";

export default function Messages() {
  const { employees } = useApp();
  const location = useLocation();
  const presetEmployeeId =
    (location.state as { employeeId?: string } | null)?.employeeId ?? "";

  const [employeeId, setEmployeeId] = useState(presetEmployeeId);
  const [message, setMessage] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [prevPreset, setPrevPreset] = useState(presetEmployeeId);

  // Adopt a new navigation preset during render (no effect needed — see
  // react.dev/you-might-not-need-an-effect).
  if (presetEmployeeId && presetEmployeeId !== prevPreset) {
    setPrevPreset(presetEmployeeId);
    setEmployeeId(presetEmployeeId);
  }

  const employee = employees.find((e) => e.id === employeeId);

  const { settings } = useApp();

  const preview = useMemo(() => {
    if (!message.trim() || !employee) return "";
    const school = settings?.schoolName ?? "مدرستي";
    return `${message.trim()}\n\nمع التقدير\n${school}`;
  }, [message, employee, settings]);

  const send = () => {
    if (!employee) {
      toast.error("اختر موظفاً أولاً");
      return;
    }
    if (!message.trim()) {
      toast.error("اختر أو اكتب رسالة أولاً");
      return;
    }
    if (!isValidPhone(employee.phone)) {
      toast.error("رقم هاتف الموظف غير صالح — عدّله من صفحة الموظفين");
      return;
    }
    openWhatsApp(employee, preview);
    toast.success("تم فتح واتساب — راجع الرسالة واضغط إرسال");
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="رسائل الشكر والتقدير" subtitle="إرسال عبر واتساب" />

      {/* Employee picker */}
      <section className="glass-strong space-y-2.5 rounded-3xl p-3.5">
        <div className="space-y-1.5">
          <Label>اختر الموظف</Label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="glass-chip w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
          >
            <option value="">— اختر موظفاً —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.position}
              </option>
            ))}
          </select>
        </div>

        {employee && (
          <div className="glass-chip flex items-center justify-between rounded-xl px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">رقم الهاتف</span>
            <span className="font-bold" dir="ltr">
              {employee.phone}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>رسائل جاهزة</Label>
          <div className="space-y-1.5">
            {THANK_YOU_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setMessage(preset);
                  setCustomMode(false);
                }}
                className={cn(
                  "glass-chip w-full rounded-xl px-3 py-2.5 text-right text-xs font-medium transition-all active:scale-[0.98]",
                  message === preset && !customMode
                    ? "ring-2 ring-primary/60"
                    : "",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>أو اكتب رسالة خاصة</Label>
          <textarea
            value={customMode ? message : ""}
            onChange={(e) => {
              setCustomMode(true);
              setMessage(e.target.value);
            }}
            rows={3}
            placeholder="اكتب رسالتك هنا…"
            className="glass-chip w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          />
        </div>
      </section>

      {/* Preview + send */}
      {preview && (
        <section className="glass-strong mt-3 rounded-3xl p-3.5">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Heart className="size-3.5 text-fuchsia-500" />
            معاينة الرسالة
          </div>
          <p className="glass-chip whitespace-pre-wrap rounded-2xl bg-emerald-50/70 px-3.5 py-3 text-sm leading-6">
            {preview}
          </p>
          <Button
            className="mt-3 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={send}
          >
            <Send className="size-4" />
            إرسال عبر واتساب
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            سيُفتح واتساب برسالة جاهزة — راجعها واضغط إرسال بنفسك
          </p>
        </section>
      )}
    </div>
  );
}
