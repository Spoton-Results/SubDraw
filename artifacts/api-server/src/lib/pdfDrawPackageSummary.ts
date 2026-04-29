import PDFDocument from "pdfkit";

const PRIMARY = "#0f5e6b";
const PRIMARY_LIGHT = "#1a8a9a";
const LIGHT_BG = "#f0f9fa";
const BORDER = "#b2dfe5";
const MUTED = "#64748b";
const TEXT = "#0f172a";
const SUCCESS_TEXT = "#16a34a";
const SUCCESS_BG = "#dcfce7";
const WARN_BG = "#fef3c7";
const WARN_TEXT = "#92400e";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(d));
}

export interface DrawPackageSummaryData {
  project: { name: string; address?: string | null };
  gc: { companyName: string };
  drawNumber: string;
  startDate: string;
  endDate: string;
  generatedAt: Date;
  subs: Array<{
    subCompanyName: string;
    tradeCategory?: string | null;
    invoices: Array<{
      invoiceNumber: string;
      amount: number;
      status: string;
      approvedAt?: Date | string | null;
    }>;
    invoiceTotal: number;
    allWaiversSigned: boolean;
    waiversSigned: number;
    waiversTotal: number;
  }>;
  totalAmount: number;
}

export async function generateDrawPackageSummaryPDF(data: DrawPackageSummaryData): Promise<Buffer> {
  const { project, gc, drawNumber, startDate, endDate, generatedAt, subs, totalAmount } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = doc.page.width;
    const MARGIN = 52;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── Header ───────────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 80).fill(PRIMARY);
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#ffffff").text("SubDraw", MARGIN, 18);
    doc.fontSize(9).font("Helvetica").fillColor("rgba(200,240,245,0.8)").text("Subcontract Management Platform", MARGIN, 42);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#ffffff")
      .text("DRAW PACKAGE SUMMARY", PAGE_W - MARGIN - 180, 28, { width: 180, align: "right" });

    let y = 100;

    // ── Project Info Block ─────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, project.address ? 100 : 80).fill(LIGHT_BG).stroke(BORDER);
    doc.rect(MARGIN, y, 4, project.address ? 100 : 80).fill(PRIMARY);

    const infoX = MARGIN + 20;
    doc.fontSize(16).font("Helvetica-Bold").fillColor(TEXT).text(project.name, infoX, y + 14, { width: CONTENT_W - 40 });
    if (project.address) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(project.address, infoX, y + 36, { width: CONTENT_W - 40 });
    }

    const drawY = project.address ? y + 56 : y + 38;
    doc.fontSize(12).font("Helvetica-Bold").fillColor(PRIMARY).text(drawNumber, infoX, drawY);
    doc.fontSize(9).font("Helvetica").fillColor(MUTED)
      .text(`Draw Period: ${formatDate(startDate + "T12:00:00")} – ${formatDate(endDate + "T12:00:00")}`, infoX + 200, drawY + 1);

    y += (project.address ? 100 : 80) + 16;

    // ── GC / Generated row ────────────────────────────────────────────────────
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
      .text(`Prepared by: ${gc.companyName}`, MARGIN, y)
      .text(`Generated: ${formatDate(generatedAt)}`, MARGIN + 280, y);
    y += 20;

    // ── Warning if any waiver missing ────────────────────────────────────────
    const unsignedSubs = subs.filter(s => !s.allWaiversSigned);
    if (unsignedSubs.length > 0) {
      doc.rect(MARGIN, y, CONTENT_W, 36).fill(WARN_BG).stroke("#fcd34d");
      doc.fontSize(9).font("Helvetica-Bold").fillColor(WARN_TEXT)
        .text(`⚠  Warning: ${unsignedSubs.length} subcontractor${unsignedSubs.length !== 1 ? "s have" : " has"} unsigned conditional lien waivers.`, MARGIN + 12, y + 13, { width: CONTENT_W - 24 });
      y += 48;
    }

    // ── Table header ──────────────────────────────────────────────────────────
    const COL = {
      sub: MARGIN,
      trade: MARGIN + 188,
      invoices: MARGIN + 302,
      amount: MARGIN + 372,
      waiver: MARGIN + 452,
    };
    const ROW_H = 28;

    doc.rect(MARGIN, y, CONTENT_W, 26).fill(PRIMARY);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff");
    doc.text("Subcontractor", COL.sub + 8, y + 9, { width: 178 });
    doc.text("Trade", COL.trade + 4, y + 9, { width: 100 });
    doc.text("Inv.", COL.invoices + 4, y + 9, { width: 64 });
    doc.text("Draw Amount", COL.amount + 4, y + 9, { width: 90, align: "right" });
    doc.text("Waiver", COL.waiver + 4, y + 9, { width: 80 });
    y += 26;

    // ── Rows ────────────────────────────────────────────────────────────────
    subs.forEach((sub, idx) => {
      const isEven = idx % 2 === 0;
      const bg = isEven ? "#f8fffe" : "#ffffff";
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).stroke(BORDER);

      doc.fontSize(8).font("Helvetica-Bold").fillColor(TEXT)
        .text(sub.subCompanyName, COL.sub + 8, y + 10, { width: 178, ellipsis: true });

      doc.fontSize(8).font("Helvetica").fillColor(MUTED)
        .text(sub.tradeCategory ?? "—", COL.trade + 4, y + 10, { width: 100 });

      doc.fontSize(8).font("Helvetica").fillColor(TEXT)
        .text(String(sub.invoices.length), COL.invoices + 4, y + 10, { width: 64 });

      doc.fontSize(8).font("Helvetica-Bold").fillColor(TEXT)
        .text(formatCurrency(sub.invoiceTotal), COL.amount + 4, y + 10, { width: 90, align: "right" });

      if (sub.allWaiversSigned) {
        doc.fontSize(8).font("Helvetica-Bold").fillColor(SUCCESS_TEXT)
          .text(`✓ Signed (${sub.waiversSigned}/${sub.waiversTotal})`, COL.waiver + 4, y + 10, { width: 80 });
      } else {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#dc2626")
          .text(`✗ Pending (${sub.waiversSigned}/${sub.waiversTotal})`, COL.waiver + 4, y + 10, { width: 80 });
      }

      y += ROW_H;

      if (y > 680) {
        doc.addPage();
        y = MARGIN;
      }
    });

    // ── Totals row ─────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(LIGHT_BG).stroke(BORDER);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT)
      .text("TOTAL DRAW AMOUNT", COL.sub + 8, y + 10, { width: 360 });
    doc.fontSize(9).font("Helvetica-Bold").fillColor(PRIMARY)
      .text(formatCurrency(totalAmount), COL.amount + 4, y + 10, { width: 90, align: "right" });
    y += 40;

    // ── Signature block ────────────────────────────────────────────────────
    if (y < 620) {
      y = Math.max(y, 560);
      doc.moveTo(MARGIN, y).lineTo(MARGIN + 200, y).stroke(BORDER);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("General Contractor Signature", MARGIN, y + 6);
      doc.moveTo(MARGIN + 280, y).lineTo(MARGIN + 420, y).stroke(BORDER);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Date", MARGIN + 280, y + 6);
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    const PAGE_H = doc.page.height;
    doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill(PRIMARY);
    doc.fontSize(8).font("Helvetica").fillColor("rgba(200,240,245,0.8)")
      .text(`${project.name} | ${drawNumber} | Generated ${formatDate(generatedAt)} | SubDraw Platform`, MARGIN, PAGE_H - 22, { width: CONTENT_W, align: "center" });

    doc.end();
  });
}
