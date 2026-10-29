import { AppHeader } from "@/components/app/AppHeader";
import { LogoAvatar } from "@/components/app/LogoAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/providers/app-provider";
import { useAuth } from "@/hooks/use-auth";
import { useBiometric } from "@/hooks/use-biometric";
import { api } from "@/convex/_generated/api";
import { QueryFallback } from "@/providers/account-gate";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { useTheme } from "next-themes";
import { fileToAvatarDataUrl } from "@/lib/image";
import { isValidTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Camera,
  ChevronLeft,
  Fingerprint,
  Loader2,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  analyticsConfigured,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "@/lib/analytics";

const DAY_LABELS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

/** Entry to the admin console — only rendered for the admin account. */
function AdminLink() {
  return (
    <QueryFallback fallback={null}>
      <AdminLinkInner />
    </QueryFallback>
  );
}

function AdminLinkInner() {
  const status = useQuery(api.devices.status);
  if (!status?.isAdmin) return null;
  return (
    <div className="mt-3">
      <Link to="/app/admin" className="block">
        <section className="glass flex items-center justify-between rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <span className="glass-chip flex size-10 shrink-0 items-center justify-center rounded-xl">
              <ShieldCheck className="size-5 text-primary" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-sm font-bold">لوحة الإدارة</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                حسابات الأجهزة، الإيقاف والاستعادة، وإغلاق التطبيق
              </p>
            </div>
          </div>
          <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
        </section>
      </Link>
    </div>
  );
}

function BiometricCard() {
  const { supported, available, enabled, enroll, disable } = useBiometric();
  const [busy, setBusy] = useState(false);
  const { settings } = useApp();

  if (!supported) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await enroll(
        settings.principalName || "مدير المدرسة",
      );
      if (result.ok) {
        toast.success("تم تفعيل القفل بالبصمة");
      } else if (result.reason !== "cancelled") {
        toast.error(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disable();
      toast.success("تم إيقاف القفل بالبصمة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="glass-chip flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Fingerprint className="size-5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">القفل بالبصمة</p>
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              {enabled
                ? "يُطلب التحقق عند فتح التطبيق وعودته من الخلفية"
                : "حماية إضافية عند فتح التطبيق باستخدام بصمتك أو قفل الجهاز"}
            </p>
          </div>
        </div>
        {busy ? (
          <span className="mt-2 flex size-8 shrink-0 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </span>
        ) : (
          <Switch
            checked={enabled === true}
            disabled={!available}
            onCheckedChange={(v) =>
              v ? void handleEnable() : void handleDisable()
            }
            aria-label="تفعيل القفل بالبصمة"
          />
        )}
      </div>
      {!available && supported && (
        <p className="mt-2 text-[11px] text-destructive">
          لا يتوفر مستخدم قياسات حيوية على هذا الجهاز — تأكد من تسجيل بصمتك في
          إعدادات النظام أولاً.
        </p>
      )}
      <p className="mt-2.5 flex items-center gap-1.5 text-[10px] leading-5 text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" />
        تُستخدم مفاتيح جهازك فقط — لا تُرسل بصمتك إلى أي خادم.
      </p>
    </section>
  );
}

function ProfileCard() {
  const { settings, saveSettings } = useApp();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const displayName =
    settings.principalName ||
    user?.name ||
    user?.email?.split("@")[0] ||
    "مدير المدرسة";

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const photo = await fileToAvatarDataUrl(file, 256);
      await saveSettings({ ...settings, principalPhoto: photo });
      toast.success("تم تحديث الصورة");
    } catch (err) {
      console.error(err);
      toast.error("تعذر قراءة الصورة — جرّب صورة أخرى");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    try {
      // undefined unsets the field locally and on the server after sync.
      await saveSettings({ ...settings, principalPhoto: undefined });
      toast.success("تم حذف الصورة");
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحذف");
    }
  };

  const isDefaultPhoto = !settings.principalPhoto;

  return (
    <section className="glass-strong rounded-3xl p-4">
      <div className="flex items-center gap-3.5">
        {/* Avatar + camera badge */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="تغيير صورة الملف الشخصي"
        >
          <span className="glass-chip flex size-16 items-center justify-center overflow-hidden rounded-full">
            {isDefaultPhoto ? (
              <LogoAvatar className="size-16" />
            ) : (
              <img
                src={settings.principalPhoto}
                alt="صورة المدير"
                className="size-16 rounded-full object-cover"
              />
            )}
          </span>
          <span className="glass-chip absolute -bottom-0.5 -left-0.5 flex size-6 items-center justify-center rounded-full text-primary transition-transform group-active:scale-90">
            {uploading ? (
              <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Camera className="size-3.5" />
            )}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onPick(e)}
        />

        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-extrabold">{displayName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user?.email ?? "حساب المدير"}
          </p>
        </div>

        {!isDefaultPhoto && (
          <Button
            variant="ghost"
            size="icon"
            className="glass-chip size-8 shrink-0 rounded-full text-destructive"
            onClick={() => void removePhoto()}
            aria-label="حذف الصورة"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-2.5 text-[10px] leading-5 text-muted-foreground">
        اضغط على الصورة لاختيار صورة شخصية من جهازك. تُحفظ محلياً وتتزامن مع
        السحابة تلقائياً.
      </p>

    </section>
  );
}

function AnalyticsCard() {
  const [enabled, setEnabled] = useState(() => getAnalyticsConsent());
  const configured = analyticsConfigured();

  const toggle = (value: boolean) => {
    setAnalyticsConsent(value);
    setEnabled(value);
    toast.success(
      value ? "تم تفعيل إحصاءات الاستخدام" : "تم إيقاف إحصاءات الاستخدام",
    );
  };

  return (
    <section className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="glass-chip flex size-10 shrink-0 items-center justify-center rounded-xl">
            <BarChart3 className="size-5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">إحصاءات الاستخدام</p>
            <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
              {enabled
                ? "تُجمع إحصاءات مجهولة لتحسين التطبيق — دون أسماء أو أرقام الموظفين"
                : "الإحصاءات متوقفة — لا يُرسَل أي شيء من هذا الجهاز"}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled && configured}
          disabled={!configured}
          onCheckedChange={toggle}
          aria-label="تفعيل إحصاءات الاستخدام"
        />
      </div>
      {!configured && (
        <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
          لم يُضبط مفتاح التحليلات في هذا البناء بعد، لذا لا يُرسَل أي شيء.
        </p>
      )}
    </section>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { settings, saveSettings } = useApp();
  const current = settings.theme ?? (theme === "dark" ? "dark" : "light");

  // Adopt the theme from the synced settings whenever a new saved value shows
  // up (e.g. restored from the cloud after a reinstall). Guarded by tracking
  // the last adopted value so we never fight the user's explicit choice.
  const lastAdoptedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const t = settings.theme;
    if (t && t !== lastAdoptedRef.current && t !== theme) {
      lastAdoptedRef.current = t;
      setTheme(t);
    }
  }, [settings.theme, theme, setTheme]);

  const choose = (value: "light" | "dark") => {
    setTheme(value);
    // Persist with the rest of the settings so it syncs to the cloud too.
    void saveSettings({ ...settings, theme: value }).catch((err) => {
      console.error(err);
      toast.error("تعذر حفظ المظهر");
    });
  };

  const options = [
    { value: "light", label: "فاتح", icon: Sun },
    { value: "dark", label: "داكن", icon: Moon },
  ] as const;

  return (
    <section className="glass rounded-3xl p-4">
      <div className="mb-2.5 flex items-center gap-2">
        {current === "dark" ? (
          <Moon className="size-4 text-primary" />
        ) : (
          <Sun className="size-4 text-primary" />
        )}
        <p className="text-sm font-bold">مظهر التطبيق</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => choose(opt.value)}
              className={cn(
                "glass-chip flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-95",
                active
                  ? "border-primary/60 text-primary shadow-sm ring-1 ring-primary/40"
                  : "text-muted-foreground",
              )}
              aria-pressed={active}
            >
              <Icon className="size-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        يُطبَّق المظهر فوراً ويُحفظ مع الإعدادات على جهازك وفي السحابة.
      </p>
    </section>
  );
}

export default function Settings() {
  const { settings, saveSettings } = useApp();
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [principalName, setPrincipalName] = useState(settings.principalName);
  const [defaultArrivalTime, setDefaultArrivalTime] = useState(
    settings.defaultArrivalTime,
  );
  const [lateThreshold, setLateThreshold] = useState(settings.lateThreshold);
  const [workingDays, setWorkingDays] = useState<number[]>(
    settings.workingDays,
  );
  const [reportFooterNote, setReportFooterNote] = useState(
    settings.reportFooterNote ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [prevSettings, setPrevSettings] = useState(settings);

  // Re-sync local form state when the persisted settings change (render-phase
  // adjustment instead of an effect, per react.dev/you-might-not-need-an-effect).
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setSchoolName(settings.schoolName);
    setPrincipalName(settings.principalName);
    setDefaultArrivalTime(settings.defaultArrivalTime);
    setLateThreshold(settings.lateThreshold);
    setWorkingDays(settings.workingDays);
    setReportFooterNote(settings.reportFooterNote ?? "");
  }

  const toggleDay = (d: number) => {
    setWorkingDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const submit = async () => {
    if (!schoolName.trim()) {
      toast.error("اسم المدرسة مطلوب");
      return;
    }
    if (!isValidTime(defaultArrivalTime) || !isValidTime(lateThreshold)) {
      toast.error("أوقات غير صالحة — استخدم صيغة HH:MM");
      return;
    }
    if (workingDays.length === 0) {
      toast.error("اختر يوم عمل واحداً على الأقل");
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        ...settings,
        schoolName: schoolName.trim(),
        principalName: principalName.trim() || "مدير المدرسة",
        defaultArrivalTime,
        lateThreshold,
        workingDays,
        reportFooterNote: reportFooterNote.trim() || undefined,
      });
      toast.success("تم حفظ الإعدادات");
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="الإعدادات" subtitle="الحساب والمظهر والمدرسة" />

      <ProfileCard />

      <div className="mt-3">
        <BiometricCard />
      </div>

      <div className="mt-3">
        <AnalyticsCard />
      </div>

      <AdminLink />

      <div className="mt-3">
        <ThemeSwitcher />
      </div>

      <section className="glass-strong mt-3 space-y-3 rounded-3xl p-4">
        <p className="text-sm font-bold">إعدادات المدرسة والدوام</p>
        <div className="space-y-1.5">
          <Label>اسم المدرسة *</Label>
          <Input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            className="glass-chip rounded-xl"
            placeholder="مثال: مدرسة السلام الابتدائية"
          />
        </div>
        <div className="space-y-1.5">
          <Label>اسم مدير المدرسة</Label>
          <Input
            value={principalName}
            onChange={(e) => setPrincipalName(e.target.value)}
            className="glass-chip rounded-xl"
            placeholder="مثال: أ. محمد أحمد"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <Label>وقت الحضور الرسمي</Label>
            <Input
              type="time"
              value={defaultArrivalTime}
              onChange={(e) => setDefaultArrivalTime(e.target.value)}
              className="glass-chip rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>حد التأخير</Label>
            <Input
              type="time"
              value={lateThreshold}
              onChange={(e) => setLateThreshold(e.target.value)}
              className="glass-chip rounded-xl"
            />
          </div>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          مثال: وقت الحضور 08:00 وحد التأخير 08:15 — الوصول 08:05 يُحسب حضوراً،
          و08:16 يُحسب تأخيراً. يمكنك دائماً اختيار الحالة يدوياً.
        </p>

        <div className="space-y-1.5">
          <Label>أيام العمل الأسبوعية</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "min-h-9 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-95",
                  workingDays.includes(d)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "glass-chip text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>ملاحظة تذييل التقرير</Label>
          <Input
            value={reportFooterNote}
            onChange={(e) => setReportFooterNote(e.target.value)}
            className="glass-chip rounded-xl"
            placeholder="اختياري — تظهر أسفل التقرير المطبوع"
          />
        </div>

        <Button
          className="w-full rounded-xl"
          onClick={() => void submit()}
          disabled={saving}
        >
          <Save className="size-4" />
          حفظ الإعدادات
        </Button>
      </section>

      {/* About / data section */}
      <section className="glass mt-3 space-y-2 rounded-3xl p-4 text-xs leading-6 text-muted-foreground">
        <p className="text-sm font-bold text-foreground">عن التطبيق</p>
        <p>
          تطبيق الحضور والإدارة المدرسية — مصمم حصرياً لمدير المدرسة. تعمل
          البيانات دون اتصال وتتزامن تلقائياً عند توفر الإنترنت.
        </p>
        <p className="flex items-center gap-1.5">
          <Save className="size-3.5" />
          النسخ الاحتياطي السحابي يعمل تلقائياً بعد كل تغيير.
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          مرخّص بموجب ترخيص حاضِر — مجاني الاستخدام، ويُمنع بيعه أو تحصيل أي
          رسوم مقابله دون إذن مسبق من المؤلف.
        </p>
      </section>
    </div>
  );
}
