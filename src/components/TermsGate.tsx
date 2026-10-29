import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Public assets must be addressed through the deploy base path so the same
 * reference works at "/" in dev and at "/<repo>/" on GitHub Pages. */
const logoSrc = `${import.meta.env.BASE_URL}logo.svg`;
import { getMeta, setMeta } from "@/lib/local-db";
import { captureEvent, setAnalyticsConsent } from "@/lib/analytics";

/** Bump this to re-prompt all users on next launch. 1.2 adds the free-use /
 *  no-selling licence terms; 1.1 added the usage-analytics paragraph. */
export const TERMS_VERSION = "1.2";
const ACCEPT_KEY = "termsAcceptedVersion";

interface Section {
  title: string;
  paras: string[];
}

const SECTIONS: Section[] = [
  {
    title: "1. المقدمة والتعريفات",
    paras: [
      "يرجى قراءة هذه الشروط والأحكام وسياسة الخصوصية بعناية قبل استخدام التطبيق. باستخدامك للتطبيق فإنك تؤكد موافقتك الكاملة عليها.",
      "«التطبيق»: تطبيق حاضِر لإدارة حضور وانصراف موظفي المدرسة.",
      "«المشغّل»: صاحب التطبيق ومالك حقوق تشغيله وإدارته.",
      "«المستخدم»: أي شخص يصل إلى التطبيق أو يستخدمه بأي طريقة.",
      "«محتوى المستخدم»: أي بيانات يُدخلها المستخدم إلى التطبيق من بينها أسماء الموظفين وسجلات الحضور والإعدادات والصور.",
    ],
  },
  {
    title: "2. ترخيص الاستخدام",
    paras: [
      "يمنحك التطبيق ترخيصًا محدودًا وغير حصري وغير قابل للنقل لإستخدامه في إدارة حضور الموظفين فقط، وفق هذه الشروط.",
      "التطبيق مجاني الاستخدام والتحميل والمشاركة للجميع دون أي مقابل مالي.",
      "يُمنع بيع التطبيق أو تحصيل أي رسوم مقابل تحميله أو استخدامه أو استضافته أو تقديمه كخدمة مدفوعة أو دمجه في منتج مدفوع — دون إذن كتابي مسبق من المشغّل. أي تعامل تجاري يستوجب التواصل مع المشغّل والاتفاق على شروطه كتابةً قبل أي شيء آخر.",
      "يحتفظ المشغّل بصلاحية كاملة وحصرية على التطبيق، بما في ذلك حقوق الملكية والتشغيل والتحديث ووضع القواعد وتعديل أو إيقاف الخدمة في أي وقت.",
    ],
  },
  {
    title: "3. السلوك المحظور",
    paras: [
      "يُمنع منعاً باتًا: هندسة العكس أو فك أو تعديل أي جزء من التطبيق؛ استخدامه في أي غرض مخالف للقانون؛ إدخال بيانات كاذبة أو مخالفة لحقوق الآخرين؛ محاولة اختراق التطبيق أو تعطيله؛ استخدامه تجارياً دون إذن كتابي مسبق من المشغّل.",
    ],
  },
  {
    title: "4. حق إيقاف الحسابات",
    paras: [
      "يحق للمشغّل، وفق تقديره البلدي، تعليق أو إنهاء أو حذف أي حساب و/أو البيانات المرتبطة به في أي وقت ودون إشعار مسبق، خاصةً عند مخالفة هذه الشروط أو عند وجود سوء استخدام.",
    ],
  },
  {
    title: "5. كيفية إلغاء/إنهاء الحساب",
    paras: [
      "يمكن للمستخدم إنهاء استخدامه للتطبيق في أي وقت بالتواصل مع إدارة المدرسة أو المشغّل، либо بحذف بيانات الموقع من إعدادات المتصفح على جهازه، وعندها تُحذف البيانات المحلية المخزّنة على ذلك الجهاز.",
    ],
  },
  {
    title: "6. ملكية المحتوى الذي تُدخله",
    paras: [
      "يحتفظ المستخدم بملكية محتواه الذي يُدخله، ومنح المشغّل ترخيصًا عالميًا وساريًا لاستخدام هذا المحتوى بالقدر اللازم لتشغيل التطبيق وتحسينه وتقديم خدماته.",
      "يحق للمشغّل الوصول إلى المحتوى المُدخل لإدارته وتشغيل الخدمة والالتزام بالأنظمة المعمول بها.",
    ],
  },
  {
    title: "7. محتوى المستخدم",
    paras: [
      "المستخدم وحده مسؤول بالكامل عن دقة ومصداقية ومشروعية البيانات التي يُدخلها، وعن استيفاء حقوق الغير (منهم الموظفون) عند إدخال بياناتهم أو صورهم.",
      "لا يضمن التطبيق خلوّه من الأخطاء، ولا يتحمّل المشغّل مسؤولية أي قرار يُتخذ بناءً على بيانات غير دقيقة أو متأخرة.",
    ],
  },
  {
    title: "8. الملكية الفكرية وحقوق النشر (DMCA)",
    paras: [
      "التطبيق وشعاره وتصميمه وكوده وجميع محتوياته مملوكة للمشغّل أو مرخصة له. يجوز مشاركة نسخة مجانية غير معدّلة مع الإبقاء على إشعار حقوق النشر، أما أي نسخ أو إعادة نشر أو توزيع بغرض تجاري فيتطلب إذنًا كتابيًا مسبقًا من المشغّل.",
      "إذا كان تعتقد بوجود محتوى ينتهك حقوقك الفكرية، يرجى إرسال إشعار مكتوب يتضمن: وصفًا دقيقًا للمحتوى المنتهك، وموقعه داخل التطبيق، وبيانات تواصلك، وإقرارًا بحسن نية وتوقيعًا. تُعالَج الإشعارات الصادقة دون مبالغة، وقد تُتخذ إجراءات قانونية ضد الإشعارات الكاذبة.",
    ],
  },
  {
    title: "9. إخلاء المسؤولية",
    paras: [
      "يُقدَّم التطبيق «كما هو» دون أي ضمانات من أي نوع، صريحة أو ضمنية، بما في ذلك ضمانات الملاءمة أو عدم الانتهاك أو الخلو من الأخطاء.",
      "لا يضمن المشغّل استمرارية الخدمة أو خلوّها من الأعطال أو ملاءمتها لغرض معين.",
    ],
  },
  {
    title: "10. تحديد المسؤولية",
    paras: [
      "بأقصى حد تسمح به الأنظمة، لا يتحمّل المشغّل أي مسؤولية عن: أي إساءة استخدام يقوم بها المستخدمون أو الغير؛ الاختراق أو الوصول غير المصرح به أو سرقة البيانات أو فقدانها بأي سبب؛ فقدان الجهاز أو تعرض حساب المستخدم لأي سوء استغلال؛ توقف الخدمة أو بطءها؛ أو أي أضرار مباشرة أو غير مباشرة أو تبعية أو عرضية.",
      "تقتصر مسؤولية المشغّل الإجمالية — إن وُجدت — على المبالغ المدفوعة فعليًا مقابل استخدام التطبيق خلال الاثني عشر شهرًا السابقة للادعاء، ولا تتجاوز بأي حال مقدار صفر (0) في حال كان الاستخدام مجانيًا.",
    ],
  },
  {
    title: "11. سياسة الخصوصية",
    paras: [
      "يُخزَّن البيانات الأساسي (الموظفون وسجلات الحضور والإعدادات) محليًا على جهاز المستخدم داخل قاعدة بيانات التطبيق، وقد يُزامَن اختياريًا مع خدمات سحابية موثوقة لتشغيل الخدمة.",
      "لا يبيع المشغّل بيانات المستخدمين ولا يشاركها لأغراض تسويقية، ولا يُتاح لجهة خارجية استخدامها إلا بالقدر اللازم لتشغيل الخدمة أو عندما يقتضي القانون ذلك.",
      "بعد موافقتك تُجمع إحصاءات استخدام مجهولة (مثل الصفحات المفتوحة والأزرار المستخدمة) لتحسين التطبيق، ولا تتضمن أسماء الموظفين أو أرقام هواتفهم أو ملاحظات الحضور. يمكنك إيقاف هذه الإحصاءات في أي وقت من الإعدادات.",
      "لا يمكن ضمان أمان مطلق للبيانات؛ فبمجرد وصول بيانات إلى الإنترنت أو جهاز متصل بالإنترنت تصبح معرّضة لمخاطر تقنية لا يتحمّل مسؤوليتها المشغّل، بما في ذلك الاختراق وسرقة البيانات وأي مسائل قانونية أخرى ناتجة عن ذلك.",
    ],
  },
  {
    title: "12. تعديل الشروط",
    paras: [
      "يحق للمشغّل تعديل هذه الشروط في أي وقت، وعند التغيير الجوهري يُطلب من المستخدم الموافقة مجددًا عند فتح التطبيق. استمرارك في الاستخدام بعد الموافقة يُعدّ قبولًا للشروط المحدّثة.",
    ],
  },
  {
    title: "13. القانون الواجب التطبيق",
    paras: [
      "تخضع هذه الشروط لأنظمة الدولة التي يُشغَّل فيها التطبيق المعمول بها، وتُحل النزاعات وديًا قدر الإمكان قبل اللجوء إلى أي مرجع قضائي.",
    ],
  },
];

export function TermsGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "accepted" | "pending">(
    "loading",
  );
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const v = await getMeta<string>(ACCEPT_KEY);
      setState(v === TERMS_VERSION ? "accepted" : "pending");
    })();
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (state === "accepted") return <>{children}</>;

  const accept = async () => {
    await setMeta(ACCEPT_KEY, TERMS_VERSION);
    // Acceptance is also the analytics opt-in (section 11 of the policy).
    setAnalyticsConsent(true);
    captureEvent("terms_accepted", { version: TERMS_VERSION });
    setState("accepted");
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      {/* Dimmed backdrop — the app itself stays hidden until acceptance. */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden
      />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border/40 bg-card shadow-2xl">
        <div className="px-5 pt-5 text-center">
          <img
            src={logoSrc}
            alt="حاضِر"
            className="mx-auto size-14 rounded-2xl"
          />
          <h1 id="terms-title" className="mt-3 text-lg font-extrabold">
            الشروط والأحكام وسياسة الخصوصية
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            اطّلع على الشروط بالضغط على السهم أدناه، ثم وافق للدخول إلى التطبيق
            لأول مرة. (الإصدار {TERMS_VERSION})
          </p>
        </div>

        {/* Collapsed by default: reading is optional, consenting is what gates entry. */}
        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
          >
            <span>اضغط لقراءة الشروط والأحكام وسياسة الخصوصية</span>
            <ChevronDown
              className={`size-5 shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        </div>

        {open && (
          <div className="mt-3 max-h-[42dvh] overflow-y-auto px-5 pb-1">
            <div className="space-y-3">
              {SECTIONS.map((s) => (
                <section key={s.title} className="glass rounded-2xl p-4">
                  <h2 className="text-sm font-extrabold">{s.title}</h2>
                  {s.paras.map((p, i) => (
                    <p
                      key={i}
                      className="mt-2 text-[13px] leading-6 text-muted-foreground"
                    >
                      {p}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-border/40 bg-background/80 p-5 backdrop-blur">
          <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-6">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span>
              توافق على الشروط والأحكام وسياسة الخصوصية، وتتعهد بالالتزام بها.
            </span>
          </label>
          <button
            type="button"
            disabled={!checked}
            onClick={() => void accept()}
            className="mt-3 min-h-12 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            الدخول إلى التطبيق
          </button>
        </div>
      </div>
    </div>
  );
}