import { AppHeader } from "@/components/app/AppHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { QueryFallback } from "@/providers/account-gate";
import { useMutation, useQuery } from "convex/react";
import {
  Crown,
  Loader2,
  Power,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatSeen(ts: number | null): string {
  if (!ts) return "لم يسجل بعد";
  return new Date(ts).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Admin console: every account (device) using the app, with full control —
 * revoke, restore, delete, promote — plus the global kill switch.
 */
export default function Admin() {
  return (
    <QueryFallback fallback={<AdminUnavailable />}>
      <AdminConsole />
    </QueryFallback>
  );
}

/** Backend not deployed / unreachable — don't crash the route. */
function AdminUnavailable() {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="لوحة الإدارة" subtitle="الحسابات والأجهزة" />
      <section className="glass rounded-3xl p-6 text-center">
        <p className="text-sm font-bold">تعذّر الاتصال بلوحة الإدارة</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          وحدات الخلفية غير متاحة على هذا الخادم بعد، أو يوجد اتصال ضعيف —
          حاول مجدداً لاحقاً.
        </p>
      </section>
    </div>
  );
}

function AdminConsole() {
  const status = useQuery(api.devices.status);
  const accounts = useQuery(api.devices.list);
  const setRevoked = useMutation(api.devices.setRevoked);
  const removeAccount = useMutation(api.devices.removeAccount);
  const setRole = useMutation(api.devices.setRole);
  const setAppDisabled = useMutation(api.devices.setAppDisabled);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      console.error("[admin]", err);
      toast.error("تعذّر التنفيذ — حاول مجدداً");
    } finally {
      setBusy(null);
    }
  };

  if (!status?.signedIn || accounts === undefined) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        <AppHeader title="لوحة الإدارة" subtitle="الحسابات والأجهزة" />
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!status.isAdmin || accounts === null) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        <AppHeader title="لوحة الإدارة" subtitle="الحسابات والأجهزة" />
        <section className="glass rounded-3xl p-6 text-center">
          <p className="text-sm font-bold">غير مصرح</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            هذه الصفحة متاحة لحساب المدير فقط.
          </p>
        </section>
      </div>
    );
  }

  const toggleShutdown = (disabled: boolean) =>
    void run(
      `shutdown-${disabled}`,
      () => setAppDisabled({ disabled }),
      disabled ? "تم إيقاف التطبيق على كل الأجهزة" : "تم تشغيل التطبيق من جديد",
    );

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader title="لوحة الإدارة" subtitle="الحسابات والأجهزة" />

      {/* Global kill switch */}
      <section className="glass rounded-3xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="glass-chip flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Power className="size-5 text-destructive" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">إغلاق التطبيق بالكامل</p>
              <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                عند التفعيل يتوقف كل جهاز عند فتح التطبيق حتى تعيد التشغيل
              </p>
            </div>
          </div>
          <Switch
            checked={status.appDisabled}
            disabled={busy !== null}
            onCheckedChange={toggleShutdown}
            aria-label="إغلاق التطبيق على كل الأجهزة"
          />
        </div>
      </section>

      {/* Accounts */}
      <section className="mt-3 space-y-2">
        <p className="px-1 text-xs font-bold text-muted-foreground">
          الحسابات المستخدمة للتطبيق ({accounts.length})
        </p>

        {accounts.length === 0 && (
          <p className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
            لا توجد حسابات بعد
          </p>
        )}

        {accounts.map((a) => {
          const label = a.name ?? a.deviceName ?? "جهاز";
          const key = String(a.id);
          return (
            <article
              key={a.id}
              className="glass-tile rounded-2xl px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                    {label}
                    {a.role === "admin" && (
                      <span className="glass-chip inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-primary">
                        <Crown className="size-3" /> مدير
                      </span>
                    )}
                    {a.revoked && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive">
                        موقوف
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {a.deviceName ?? "جهاز"} • آخر ظهور: {formatSeen(a.lastSeenAt)}
                  </p>
                </div>
              </div>

              {!a.self && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl px-2.5 text-[11px]"
                    disabled={busy === key}
                    onClick={() =>
                      void run(
                        key,
                        () => setRevoked({ userId: a.id as Id<"users">, revoked: !a.revoked }),
                        a.revoked ? "تمت استعادة الحساب" : "تم إيقاف الحساب",
                      )
                    }
                  >
                    {busy === key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : a.revoked ? (
                      <RotateCcw className="size-3.5" />
                    ) : (
                      <UserX className="size-3.5" />
                    )}
                    {a.revoked ? "استعادة" : "إيقاف"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl px-2.5 text-[11px]"
                    disabled={busy === key}
                    onClick={() =>
                      void run(
                        `role-${key}`,
                        () =>
                          setRole({
                            userId: a.id as Id<"users">,
                            role: a.role === "admin" ? "member" : "admin",
                          }),
                        a.role === "admin" ? "تم إلغاء الإدارة" : "تمت ترقية المدير",
                      )
                    }
                  >
                    <ShieldCheck className="size-3.5" />
                    {a.role === "admin" ? "إلغاء الإدارة" : "ترقية لمدير"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-xl px-2.5 text-[11px] text-destructive hover:text-destructive"
                        disabled={busy === key}
                      >
                        <Trash2 className="size-3.5" />
                        حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيُوقف الحساب ويُفضّى من بياناته، ولن يتمكن هذا الجهاز
                          من استخدام التطبيق مجدداً إلا باستعادته من لوحة
                          الإدارة.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-row-reverse gap-2">
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() =>
                            void run(
                              `del-${key}`,
                              () => removeAccount({ userId: a.id as Id<"users"> }),
                              "تم حذف الحساب",
                            )
                          }
                        >
                          حذف نهائي
                        </AlertDialogAction>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {a.self && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  هذا جهازك الحالي
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
