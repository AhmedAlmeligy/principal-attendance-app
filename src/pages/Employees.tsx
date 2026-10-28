import { AppHeader } from "@/components/app/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/providers/app-provider";
import {
  ARAB_COUNTRIES,
  DEFAULT_COUNTRY_DIAL,
  OTHER_COUNTRIES,
} from "@/lib/countries";
import { EMPLOYEE_CATEGORIES } from "@/lib/types";
import {
  combinePhone,
  formatPhoneDisplay,
  isValidPhone,
  splitPhone,
} from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface FormState {
  id?: string;
  name: string;
  /** Country dial code selected in the picker (e.g. "968"). */
  dial: string;
  /** National digits as typed, without the dial code. */
  phone: string;
  position: string;
  category: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  dial: DEFAULT_COUNTRY_DIAL,
  phone: "",
  position: "",
  category: EMPLOYEE_CATEGORIES[0].value,
  notes: "",
};

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("الكل");
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [withHistory, setWithHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim();
    return employees.filter(
      (e) =>
        (category === "الكل" || e.category === category) &&
        (!q ||
          e.name.includes(q) ||
          e.position.includes(q) ||
          e.phone.includes(q)),
    );
  }, [employees, search, category]);

  const openAdd = () => setForm({ ...EMPTY_FORM });

  const openEdit = (id: string) => {
    const e = employees.find((x) => x.id === id);
    if (!e) return;
    const { dial, local } = splitPhone(e.phone);
    setForm({
      id: e.id,
      name: e.name,
      dial,
      phone: local,
      position: e.position,
      category: e.category,
      notes: e.notes ?? "",
    });
  };

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("اسم الموظف مطلوب");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("رقم الهاتف مطلوب");
      return;
    }
    const phone = combinePhone(form.dial, form.phone);
    if (!isValidPhone(phone)) {
      toast.error("رقم هاتف غير صالح — راجع الدولة وعدد أرقام الرقم");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await updateEmployee({
          id: form.id,
          name: form.name.trim(),
          phone,
          position: form.position.trim() || "موظف",
          category: form.category,
          notes: form.notes.trim() || undefined,
        });
        toast.success("تم حفظ التعديلات");
      } else {
        await addEmployee({
          name: form.name.trim(),
          phone,
          position: form.position.trim() || "موظف",
          category: form.category,
          notes: form.notes.trim() || undefined,
        });
        toast.success("تمت إضافة الموظف");
      }
      setForm(null);
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ، حاول مجدداً");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEmployee({ id: deleteTarget, withHistory });
      toast.success(
        withHistory ? "تم حذف الموظف وسجلّاته" : "تم حذف الموظف",
      );
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحذف");
    } finally {
      setDeleteTarget(null);
      setWithHistory(false);
    }
  };

  const categories = ["الكل", ...EMPLOYEE_CATEGORIES.map((c) => c.value)];

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <AppHeader
        title="الموظفين"
        subtitle={`${employees.length} موظف مسجل`}
      />

      <section className="glass-strong space-y-2.5 rounded-3xl p-3.5">
        <div className="flex gap-2">
          <label className="glass-chip flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو المنصب أو الهاتف…"
              className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </label>
          <Button
            className="shrink-0 rounded-xl"
            onClick={openAdd}
            aria-label="إضافة موظف"
          >
            <Plus className="size-4" />
            إضافة
          </Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-95",
                category === c
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-chip text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <UserRound className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold">
              {employees.length === 0
                ? "لا يوجد موظفون بعد"
                : "لا نتائج مطابقة"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {employees.length === 0
                ? "اضغط «إضافة» لإضافة أول موظف"
                : "جرّب تعديل البحث أو التصفية"}
            </p>
          </div>
        ) : (
          filtered.map((e) => (
            <article key={e.id} className="glass-tile rounded-2xl p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{e.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.position} • {e.category}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground" dir="ltr">
                    <Phone className="size-3" />
                    {formatPhoneDisplay(e.phone)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-chip size-8 rounded-full"
                    onClick={() => openEdit(e.id)}
                    aria-label="تعديل"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="glass-chip size-8 rounded-full text-destructive"
                    onClick={() => setDeleteTarget(e.id)}
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/50 pt-2.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  حضور اليوم السريع
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-[10px] font-bold text-primary"
                  onClick={() =>
                    navigate(`/app/employees/${e.id}`)
                  }
                >
                  السجل التفصيلي
                  <ChevronLeft className="size-3.5" />
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Add / Edit sheet */}
      <Sheet
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
      >
        <SheetContent side="bottom" className="glass-strong rounded-t-3xl">
          <SheetHeader className="text-right">
            <SheetTitle>
              {form?.id ? "تعديل موظف" : "إضافة موظف جديد"}
            </SheetTitle>
          </SheetHeader>
          {form && (
            <div className="space-y-3 px-4 pb-8">
              <div className="space-y-1.5">
                <Label>الاسم الكامل *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثال: أحمد محمد"
                  className="glass-chip rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الدولة *</Label>
                <select
                  value={form.dial}
                  onChange={(e) => setForm({ ...form, dial: e.target.value })}
                  className="glass-chip w-full rounded-xl px-3 py-2.5 text-sm font-semibold outline-none"
                >
                  <optgroup label="الدول العربية">
                    {ARAB_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.dial}>
                        {c.flag} {c.name} ({`+${c.dial}`})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="دول أخرى">
                    {OTHER_COUNTRIES.map((c, i) => (
                      <option
                        key={`${c.code}-${i}`}
                        value={c.dial}
                      >
                        {c.flag} {c.name} ({`+${c.dial}`})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف (واتساب) *</Label>
                <div
                  dir="ltr"
                  className="glass-chip flex items-center gap-2 rounded-xl px-3 py-2.5"
                >
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {`+${form.dial}`}
                  </span>
                  <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="90010233"
                    inputMode="tel"
                    dir="ltr"
                    aria-label="رقم الهاتف بدون رمز الدولة"
                    className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  اختر الدولة أولاً ثم اكتب الرقم فقط بدون رمز الدولة وبدون
                  الصفر الأول
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>المنصب الوظيفي</Label>
                <Input
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  placeholder="مثال: مدرس رياضيات"
                  className="glass-chip rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>القسم</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMPLOYEE_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: c.value })}
                      className={cn(
                        "min-h-9 rounded-full px-3.5 text-xs font-semibold transition-all active:scale-95",
                        form.category === c.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "glass-chip text-muted-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="glass-chip w-full rounded-xl px-3 py-2 text-sm outline-none"
                  placeholder="اختياري"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1 rounded-xl"
                  onClick={() => void submit()}
                  disabled={saving}
                >
                  حفظ
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setForm(null)}
                  disabled={saving}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف الموظف؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. يمكنك اختيار الاحتفاظ بسجل
              الحضور التاريخي للموظف أو حذفه معه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="glass-chip flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={withHistory}
              onChange={(e) => setWithHistory(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            حذف سجلات الحضور التاريخية أيضاً
          </label>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              حذف نهائي
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
