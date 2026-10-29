import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  CalendarCheck2,
  CloudCheck,
  FileText,
  Heart,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router";

/** Public assets must be addressed through the deploy base path so the same
 * reference works at "/" in dev and at "/<repo>/" on GitHub Pages. */
const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: "حضور بلمسة واحدة",
    desc: "سجّل حضور أو تأخير أو غياب أو مأذونية لكل موظف بأربع أزرار سريعة — بدون خطوات إضافية.",
    tint: "text-primary",
  },
  {
    icon: Users,
    title: "إدارة الموظفين",
    desc: "أضف الموظفين ونسّقهم حسب الأقسام، مع بحث فوري وتفاصيل كاملة لكل موظف.",
    tint: "text-chart-2",
  },
  {
    icon: BarChart3,
    title: "تقارير شهرية شاملة",
    desc: "إحصائيات دقيقة: أيام الحضور والتأخير والغياب ونسب الحضور وإجمالي دقائق التأخير.",
    tint: "text-chart-3",
  },
  {
    icon: FileText,
    title: "تقرير PDF رسمي",
    desc: "أنشئ تقريراً عربياً منسقاً بترويسة المدرسة وجدول السجلات والإحصائيات وخانة التوقيع.",
    tint: "text-chart-4",
  },
  {
    icon: Heart,
    title: "رسائل شكر عبر واتساب",
    desc: "أرسل رسائل تقدير جاهزة أو خاصة للموظفين مباشرة عبر واتساب بضغطة زر.",
    tint: "text-chart-5",
  },
  {
    icon: CloudCheck,
    title: "يعمل بدون إنترنت",
    desc: "كل بياناتك محفوظة على جهازك وتتزامن تلقائياً مع السحابة عند رجوع الاتصال.",
    tint: "text-emerald-600 dark:text-emerald-400",
  },
];

const STEPS = [
  { n: "١", t: "أضف موظفيك", d: "الأسماء والمناصب وأرقام الواتساب" },
  { n: "٢", t: "سجّل الحضور يومياً", d: "بلمسة واحدة لكل موظف" },
  { n: "٣", t: "اطلع التقرير", d: "PDF رسمي جاهز للطباعة والتوقيع" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
      dir="rtl"
    >
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-10">
        {/* Hero */}
        <header className="glass-strong rounded-3xl p-6 text-center">
          <div className="glass-chip mx-auto flex size-16 items-center justify-center rounded-3xl">
            <img
              src={logoSrc}
              alt="حاضِر"
              className="size-10 rounded-2xl"
            />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold leading-snug">
            حاضِر
            <br />
            حضور وانصراف الموظفين
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            سجّل حضور الموظفين بلمسة واحدة، واطّلع على تقارير شهرية احترافية،
            وأرسل رسائل شكر — كل ذلك من هاتفك، حتى بدون إنترنت.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/app")}
              className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              ابدأ الآن
              <ArrowLeft className="mr-2 inline size-4" />
            </button>
            <p className="text-[11px] text-muted-foreground">
              مصمم حصرياً لمدير المدرسة — مستخدم واحد، تحكم كامل
            </p>
          </div>
        </header>

        {/* Features */}
        <section className="mt-5">
          <h2 className="mb-3 px-1 text-base font-extrabold">
            كل ما يحتاجه المدير
          </h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.article
                  key={f.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.4 }}
                  className="glass-tile rounded-2xl p-4"
                >
                  <span
                    className={`glass-chip flex size-10 items-center justify-center rounded-2xl ${f.tint}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-bold">{f.title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    {f.desc}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-5">
          <h2 className="mb-3 px-1 text-base font-extrabold">كيف يعمل؟</h2>
          <div className="glass rounded-3xl p-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-start gap-3 py-2">
                <span className="glass-chip flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-primary">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-bold">{s.t}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="ms-11 mt-1 h-px flex-1 bg-border/60" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="glass-strong mt-5 rounded-3xl p-6 text-center">
          <h2 className="text-lg font-extrabold">جاهز لتبسيط إدارة الحضور؟</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            ابدأ بتسجيل الحضور خلال دقيقة واحدة — بدون تسجيل دخول
          </p>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="mt-4 min-h-11 w-full rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            ابدأ الآن
          </button>
        </section>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          © 2026 حاضِر — يعمل ببيانات مشفرة ومزامنة سحابية
        </p>
        <p className="mt-1.5 text-center text-[10px] leading-5 text-muted-foreground/80">
          التطبيق مجاني الاستخدام للجميع — يُمنع بيعه أو تحصيل أي رسوم مقابله
          دون إذن مسبق من المؤلف
        </p>
      </div>
    </motion.div>
  );
}
