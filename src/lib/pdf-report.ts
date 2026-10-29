/**
 * Client-side PDF export for the monthly report.
 *
 * The report is painted onto a canvas (the browser shapes and lays out the
 * Arabic text correctly, including RTL) and each page is embedded in a small,
 * hand-written PDF as a DCTDecode image. That produces a real `.pdf` file
 * everywhere — desktop browsers, and the Android WebView, which has neither
 * `window.print()` nor a working Web Share sheet.
 */
import { formatNumericDate, todayKey } from "./datetime";
import {
  attendanceRate,
  EMPTY_STATS,
  formatLateMinutes,
  MonthlyReport,
} from "./reports";
import { AppSettings, STATUS_LABELS } from "./types";

/** A4 portrait at 150 dpi — crisp on screen and in print. */
const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 72;

const TABLE_HEADER_H = 46;
const ROW_H = 38;
const HEADER_1_H = 196;
const HEADER_CONT_H = 96;
const FOOTER_H = 150;
const BOTTOM_LIMIT = PAGE_H - MARGIN - 44; // leave the page number room

const INK = "#0f172a";
const MUTED = "#475569";
const LINE = "#94a3b8";
const HEAD_BG = "#eef2f7";

const FONT_STACK = '"Noto Kufi Arabic", "Tajawal", system-ui, sans-serif';

interface Column {
  label: string;
  frac: number;
  align: CanvasTextAlign;
}

const DETAIL_COLS: Column[] = [
  { label: "اسم الموظف", frac: 0.4, align: "right" },
  { label: "التاريخ", frac: 0.22, align: "center" },
  { label: "الوقت", frac: 0.18, align: "center" },
  { label: "الحالة", frac: 0.2, align: "center" },
];

const STATS_COLS: Column[] = [
  { label: "الموظف", frac: 0.3, align: "right" },
  { label: "حضور", frac: 0.11, align: "center" },
  { label: "تأخير", frac: 0.1, align: "center" },
  { label: "غياب", frac: 0.1, align: "center" },
  { label: "مأذونية", frac: 0.12, align: "center" },
  { label: "نسبة الحضور", frac: 0.13, align: "center" },
  { label: "إجمالي التأخير", frac: 0.14, align: "center" },
];

export interface ReportPdfInput {
  report: MonthlyReport;
  settings: AppSettings;
  monthLabel: string;
  scopeLabel: string;
}

export interface PdfImagePage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

// ---------- layout ----------

interface PagePlan {
  /** Detail rows this page shows (empty for the stats-only page). */
  rows: MonthlyReport["rows"];
  /** The table header row is drawn above them. */
  showDetailTable: boolean;
  /** The stats block + signature footer go on this page. */
  withStats: boolean;
}

function planPages(input: ReportPdfInput): PagePlan[] {
  const { report } = input;
  const plans: PagePlan[] = [];
  const statsRows = report.employees.length;
  const statsBlockH =
    44 + TABLE_HEADER_H + statsRows * ROW_H + 12 + FOOTER_H; // title + table + footer

  const capacity = (headerH: number, withFooter: boolean) =>
    Math.max(
      0,
      Math.floor(
        (BOTTOM_LIMIT -
          MARGIN -
          headerH -
          TABLE_HEADER_H -
          (withFooter ? FOOTER_H : 0)) /
          ROW_H,
      ),
    );

  if (report.rows.length === 0) {
    // A single page: empty-table message, stats and footer.
    plans.push({ rows: [], showDetailTable: false, withStats: true });
    return plans;
  }

  let index = 0;
  let first = true;
  while (index < report.rows.length) {
    const headerH = first ? HEADER_1_H : HEADER_CONT_H;
    const remaining = report.rows.length - index;
    const withFooterRoom = capacity(headerH, true);
    const withoutFooterRoom = capacity(headerH, false);

    // Will the rest of the rows + stats + signature fit on this page?
    const restIsLastPage =
      remaining <= withFooterRoom &&
      rowsHeight(remaining) + statsBlockH <=
        BOTTOM_LIMIT - MARGIN - headerH - TABLE_HEADER_H;
    const take = restIsLastPage
      ? remaining
      : Math.max(1, Math.min(withoutFooterRoom, remaining));

    plans.push({
      rows: report.rows.slice(index, index + take),
      showDetailTable: true,
      withStats: restIsLastPage,
    });
    index += take;
    first = false;
  }

  const last = plans[plans.length - 1];
  if (!last.withStats) {
    // The stats block + signature need a page of their own.
    plans.push({ rows: [], showDetailTable: false, withStats: true });
  }
  return plans;
}

function rowsHeight(count: number): number {
  return count * ROW_H;
}

// ---------- painting ----------

function newPageCanvas(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return ctx;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  align: CanvasTextAlign,
  color: string,
) {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** Truncate so the cell never overflows its column. */
function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  cols: Column[],
  rows: string[][],
  rightX: number,
  topY: number,
  headerBg: boolean,
): number {
  const width = PAGE_W - 2 * MARGIN;
  let y = topY;

  // Header row
  if (headerBg) {
    ctx.fillStyle = HEAD_BG;
    ctx.fillRect(MARGIN, y, width, TABLE_HEADER_H);
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN, y + 0.5, width, TABLE_HEADER_H + rows.length * ROW_H);
  let x = rightX;
  for (const col of cols) {
    const colW = col.frac * width;
    x -= colW;
    const label = col.label;
    text(
      ctx,
      label,
      col.align === "right" ? x + colW - 10 : x + colW / 2,
      y + TABLE_HEADER_H / 2 + 7,
      `700 19px ${FONT_STACK}`,
      col.align,
      INK,
    );
    // vertical separators
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y);
    ctx.lineTo(x + 0.5, y + TABLE_HEADER_H + rows.length * ROW_H);
    ctx.stroke();
  }
  y += TABLE_HEADER_H;

  // Body rows
  for (const cells of rows) {
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(MARGIN, y + ROW_H + 0.5);
    ctx.lineTo(MARGIN + width, y + ROW_H + 0.5);
    ctx.stroke();

    let cx = rightX;
    cols.forEach((col, i) => {
      const colW = col.frac * width;
      cx -= colW;
      const raw = cells[i] ?? "";
      ctx.font = `500 19px ${FONT_STACK}`;
      const value = fitText(ctx, raw, colW - 20);
      text(
        ctx,
        value,
        col.align === "right" ? cx + colW - 10 : cx + colW / 2,
        y + ROW_H / 2 + 7,
        `500 19px ${FONT_STACK}`,
        col.align,
        INK,
      );
    });
    y += ROW_H;
  }
  return y;
}

function drawPageHeader(
  ctx: CanvasRenderingContext2D,
  input: ReportPdfInput,
  first: boolean,
): number {
  const { settings, monthLabel, scopeLabel } = input;
  const rightX = PAGE_W - MARGIN;

  if (first) {
    text(
      ctx,
      settings.schoolName,
      rightX,
      MARGIN + 44,
      `800 42px ${FONT_STACK}`,
      "right",
      INK,
    );
    text(
      ctx,
      `التقرير الشهري للحضور والغياب — ${monthLabel}`,
      rightX,
      MARGIN + 96,
      `700 27px ${FONT_STACK}`,
      "right",
      INK,
    );
    text(
      ctx,
      `النطاق: ${scopeLabel}`,
      rightX,
      MARGIN + 136,
      `500 21px ${FONT_STACK}`,
      "right",
      MUTED,
    );
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN, MARGIN + HEADER_1_H - 22);
    ctx.lineTo(rightX, MARGIN + HEADER_1_H - 22);
    ctx.stroke();
    return MARGIN + HEADER_1_H;
  }

  text(
    ctx,
    `${settings.schoolName} — ${monthLabel}`,
    rightX,
    MARGIN + 30,
    `700 24px ${FONT_STACK}`,
    "right",
    INK,
  );
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, MARGIN + HEADER_CONT_H - 26);
  ctx.lineTo(rightX, MARGIN + HEADER_CONT_H - 26);
  ctx.stroke();
  return MARGIN + HEADER_CONT_H;
}

function drawStatsBlock(
  ctx: CanvasRenderingContext2D,
  input: ReportPdfInput,
  topY: number,
): number {
  const { report } = input;
  let y = topY;
  const rightX = PAGE_W - MARGIN;

  text(
    ctx,
    "الإحصائيات الشهرية",
    rightX,
    y + 30,
    `800 26px ${FONT_STACK}`,
    "right",
    INK,
  );
  y += 44;

  const rows = report.employees.map((e) => {
    const s = report.perEmployee.get(e.id) ?? EMPTY_STATS;
    return [
      e.name,
      String(s.present),
      String(s.late),
      String(s.absent),
      String(s.permission),
      `${attendanceRate(s)}٪`,
      formatLateMinutes(s.lateMinutes),
    ];
  });
  if (rows.length === 0) {
    text(
      ctx,
      "لا يوجد موظفون",
      rightX,
      y + 30,
      `500 20px ${FONT_STACK}`,
      "right",
      MUTED,
    );
    y += 56;
  } else {
    y = drawTable(ctx, STATS_COLS, rows, rightX, y, true);
  }
  return y;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: ReportPdfInput,
  topY: number,
): number {
  const { settings } = input;
  const rightX = PAGE_W - MARGIN;
  const y = Math.max(topY + 40, PAGE_H - MARGIN - FOOTER_H + 30);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y - 24);
  ctx.lineTo(rightX, y - 24);
  ctx.stroke();

  text(
    ctx,
    `تاريخ الإنشاء: ${formatNumericDate(todayKey())}`,
    rightX,
    y + 6,
    `500 19px ${FONT_STACK}`,
    "right",
    INK,
  );
  if (settings.reportFooterNote) {
    text(
      ctx,
      settings.reportFooterNote,
      rightX,
      y + 36,
      `500 16px ${FONT_STACK}`,
      "right",
      MUTED,
    );
  }

  text(
    ctx,
    settings.principalName,
    MARGIN,
    y + 6,
    `700 21px ${FONT_STACK}`,
    "left",
    INK,
  );
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y + 54);
  ctx.lineTo(MARGIN + 260, y + 54);
  ctx.stroke();
  text(
    ctx,
    "توقيع مدير المدرسة",
    MARGIN,
    y + 82,
    `500 17px ${FONT_STACK}`,
    "left",
    MUTED,
  );
  return y;
}

async function renderPage(
  input: ReportPdfInput,
  plan: PagePlan,
  index: number,
  total: number,
): Promise<PdfImagePage> {
  const ctx = newPageCanvas();
  const rightX = PAGE_W - MARGIN;

  const y0 = drawPageHeader(ctx, input, index === 0);
  let y = y0;

  if (plan.showDetailTable) {
    const cells = plan.rows.map((r) => [
      r.employeeName,
      r.date,
      r.time,
      STATUS_LABELS[r.status],
    ]);
    y = drawTable(ctx, DETAIL_COLS, cells, rightX, y, true);
  } else {
    text(
      ctx,
      "لا توجد سجلات لهذا الشهر",
      rightX,
      y + 40,
      `600 22px ${FONT_STACK}`,
      "right",
      MUTED,
    );
    y += 70;
  }

  if (plan.withStats) {
    y = drawStatsBlock(ctx, input, y + 24);
    drawFooter(ctx, input, y + 20);
  }

  // Page number
  text(
    ctx,
    `صفحة ${index + 1} من ${total}`,
    PAGE_W / 2,
    PAGE_H - 34,
    `500 17px ${FONT_STACK}`,
    "center",
    MUTED,
  );

  const canvas = ctx.canvas;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("ENCODE_FAILED"))),
      "image/jpeg",
      0.92,
    );
  });
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  return { jpeg, width: canvas.width, height: canvas.height };
}

// ---------- PDF assembly ----------

class ByteSink {
  private parts: Uint8Array[] = [];
  private encoder = new TextEncoder();
  private size = 0;

  get length(): number {
    return this.size;
  }

  ascii(value: string): void {
    this.append(this.encoder.encode(value));
  }

  append(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.size += bytes.length;
  }

  toUint8Array(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.size);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, "0")} 00000 n \n`;
}

/**
 * Wrap JPEG page images in a minimal, spec-conformant PDF
 * (catalog → pages → page + content stream + DCTDecode image XObject).
 */
export function jpegPagesToPdf(pages: PdfImagePage[]): Blob {
  if (pages.length === 0) throw new Error("NO_PAGES");
  const sink = new ByteSink();
  const offsets: number[] = []; // index = object number - 1

  sink.ascii("%PDF-1.4\n");

  const pushObj = (body: string) => {
    offsets.push(sink.length);
    sink.ascii(body);
  };
  const pushStreamObj = (
    dict: string,
    stream: Uint8Array,
  ) => {
    offsets.push(sink.length);
    sink.ascii(`${dict}\nstream\n`);
    sink.append(stream);
    sink.ascii("\nendstream\nendobj\n");
  };

  const kids = pages
    .map((_, i) => `${3 + i * 3} 0 R`)
    .join(" ");

  pushObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pushObj(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`,
  );

  pages.forEach((page, i) => {
    const pageObj = 3 + i * 3;
    const contentObj = pageObj + 1;
    const imageObj = pageObj + 2;

    pushObj(
      `${pageObj} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /XObject << /Im0 ${imageObj} 0 R >> >> ` +
        `/Contents ${contentObj} 0 R >>\nendobj\n`,
    );

    const content = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im0 Do\nQ`;
    pushStreamObj(
      `${contentObj} 0 obj\n<< /Length ${content.length} >>`,
      new TextEncoder().encode(content),
    );

    pushStreamObj(
      `${imageObj} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image ` +
        `/Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Length ${page.jpeg.length} >>`,
      page.jpeg,
    );
  });

  const xrefStart = sink.length;
  // Objects are numbered 1..objCount; the xref table also reserves slot 0.
  const objCount = 2 + pages.length * 3;
  const size = objCount + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 0; i < objCount; i++) xref += xrefEntry(offsets[i]);
  xref +=
    `trailer\n<< /Size ${size} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF\n`;
  sink.ascii(xref);

  return new Blob([sink.toUint8Array()], { type: "application/pdf" });
}

// ---------- public API ----------

export async function buildReportPdf(
  input: ReportPdfInput,
): Promise<Blob> {
  // Make sure the Arabic webfont is ready before painting the canvas.
  try {
    await document.fonts?.ready;
  } catch {
    /* optional */
  }
  const plans = planPages(input);
  const pages: PdfImagePage[] = [];
  for (let i = 0; i < plans.length; i++) {
    pages.push(await renderPage(input, plans[i], i, plans.length));
  }
  return jpegPagesToPdf(pages);
}

/** base64 for the Android file bridge (which cannot read a Blob). */
export function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  });
}
