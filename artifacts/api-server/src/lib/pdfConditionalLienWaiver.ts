import PDFDocument from "pdfkit";

const PRIMARY = "#0f5e6b";
const PRIMARY_LIGHT = "#1a8a9a";
const LIGHT_BG = "#f0f9fa";
const BORDER = "#b2dfe5";
const MUTED = "#64748b";
const TEXT = "#0f172a";
const PENDING_BG = "#fffbf0";
const PENDING_BORDER = "#fde68a";
const PENDING_ACCENT = "#f59e0b";
const SUCCESS_BG = "#dcfce7";
const SUCCESS_TEXT = "#16a34a";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(d));
}

export interface ConditionalLienWaiverPDFData {
  waiver: {
    id: string;
    signedByName?: string | null;
    signedAt?: Date | string | null;
    approvedAt: Date | string;
    invoiceNumber: string;
    amount: number;
    projectName: string;
    projectAddress?: string | null;
    gcCompanyName: string;
    subCompanyName: string;
    subAddress?: string | null;
  };
}

export async function generateConditionalLienWaiverPDF(data: ConditionalLienWaiverPDFData): Promise<Buffer> {
  const { waiver } = data;
  const address = waiver.projectAddress?.trim() || "the project property";
  const isSigned = !!(waiver.signedByName && waiver.signedAt);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = 612;
    const PAGE_H = 792;
    const MARGIN = 48;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 80).fill(PRIMARY);

    doc.fontSize(18).font("Helvetica-Bold").fillColor("#ffffff")
      .text("CONDITIONAL LIEN WAIVER", MARGIN, 22);
    doc.fontSize(9).font("Helvetica").fillColor("rgba(180,230,240,0.85)")
      .text("Conditional Waiver and Release on Progress Payment", MARGIN, 44);

    const docLabel = `Waiver #${waiver.invoiceNumber}`;
    const labelW = 160;
    doc.fontSize(9).font("Helvetica-Bold").fillColor("rgba(180,230,240,0.75)")
      .text(docLabel, PAGE_W - MARGIN - labelW, 22, { width: labelW, align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor("rgba(180,230,240,0.75)")
      .text(`Approved: ${formatDate(waiver.approvedAt)}`, PAGE_W - MARGIN - labelW, 36, { width: labelW, align: "right" });

    let y = 100;

    // ── Parties info block ───────────────────────────────────────────────────
    doc.roundedRect(MARGIN, y, CONTENT_W, 100, 8).fill(LIGHT_BG).stroke(BORDER);
    doc.rect(MARGIN, y, 4, 100).fill(PRIMARY);

    const col1X = MARGIN + 20;
    const col2X = MARGIN + CONTENT_W / 2;

    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("PROJECT", col1X, y + 12);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT).text(waiver.projectName, col1X, y + 22, { width: CONTENT_W / 2 - 30 });
    if (waiver.projectAddress) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(waiver.projectAddress, col1X, y + 38, { width: CONTENT_W / 2 - 30 });
    }
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("GENERAL CONTRACTOR", col1X, y + 62);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT).text(waiver.gcCompanyName, col1X, y + 72, { width: CONTENT_W / 2 - 30 });

    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("SUBCONTRACTOR (CLAIMANT)", col2X, y + 12);
    doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT).text(waiver.subCompanyName, col2X, y + 22, { width: CONTENT_W / 2 - 20 });
    if (waiver.subAddress) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(waiver.subAddress, col2X, y + 38, { width: CONTENT_W / 2 - 20 });
    }

    y += 116;

    // ── Invoice details ──────────────────────────────────────────────────────
    const payRows = [
      ["Invoice Number", `#${waiver.invoiceNumber}`],
      ["Invoice Amount", formatCurrency(waiver.amount)],
      ["Invoice Approved Date", formatDate(waiver.approvedAt)],
    ];

    const ROW_H = 26;
    const labelPad = MARGIN + 14;
    const valX = MARGIN + CONTENT_W - 4;

    doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY).text("INVOICE DETAILS", MARGIN, y);
    y += 14;

    payRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : LIGHT_BG;
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(bg);
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(row[0], labelPad, y + 8);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT).text(row[1], valX - 180, y + 8, { width: 180, align: "right" });
      y += ROW_H;
    });

    doc.roundedRect(MARGIN, y - ROW_H * payRows.length - 14, CONTENT_W, ROW_H * payRows.length + 14, 6)
      .lineWidth(1).strokeColor(BORDER).stroke();

    y += 16;

    // ── Waiver statement ─────────────────────────────────────────────────────
    doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY).text("WAIVER STATEMENT", MARGIN, y);
    y += 16;

    const waiverText =
      `This conditional waiver and release is effective when the claimant has been paid in full for ` +
      `labor, services, equipment, or materials provided through ${formatDate(waiver.approvedAt)}. ` +
      `Until that time, this document does not affect the claimant's lien rights or bond rights, if any. ` +
      `\n\nClaimant: ${waiver.subCompanyName}` +
      (waiver.subAddress ? `\nAddress: ${waiver.subAddress}` : "") +
      `\nGeneral Contractor: ${waiver.gcCompanyName}` +
      `\nProject: ${waiver.projectName}` +
      (waiver.projectAddress ? ` — ${waiver.projectAddress}` : "") +
      `\nInvoice: #${waiver.invoiceNumber}  |  Amount: ${formatCurrency(waiver.amount)}`;

    const statementBoxH = 150;
    doc.roundedRect(MARGIN, y, CONTENT_W, statementBoxH, 8)
      .fill(PENDING_BG).stroke(PENDING_BORDER);
    doc.rect(MARGIN, y, 4, statementBoxH).fill(PENDING_ACCENT);

    doc.fontSize(10).font("Helvetica").fillColor(TEXT)
      .text(waiverText, MARGIN + 18, y + 12, { width: CONTENT_W - 28, lineGap: 3 });

    y += statementBoxH + 20;

    // ── Signature section ────────────────────────────────────────────────────
    doc.fontSize(10).font("Helvetica-Bold").fillColor(PRIMARY).text("ELECTRONIC SIGNATURE", MARGIN, y);
    y += 16;

    if (isSigned) {
      const sigBoxH = 100;
      doc.roundedRect(MARGIN, y, CONTENT_W, sigBoxH, 8)
        .fill(SUCCESS_BG).stroke("#86efac");
      doc.rect(MARGIN, y, 4, sigBoxH).fill(SUCCESS_TEXT);

      doc.circle(MARGIN + CONTENT_W - 24, y + 24, 16).fill(SUCCESS_TEXT);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff").text("✓", MARGIN + CONTENT_W - 31, y + 17);

      doc.fontSize(8).font("Helvetica-Bold").fillColor(SUCCESS_TEXT).text("ELECTRONICALLY SIGNED", MARGIN + 18, y + 12);

      doc.fontSize(20).font("Helvetica-BoldOblique").fillColor("#1a5c30")
        .text(waiver.signedByName!, MARGIN + 18, y + 28);

      doc.moveTo(MARGIN + 18, y + 55).lineTo(MARGIN + CONTENT_W - 50, y + 55)
        .lineWidth(1).strokeColor("#86efac").stroke();

      doc.fontSize(7).font("Helvetica").fillColor(MUTED)
        .text("Electronic signature — by typing their full legal name the signatory agrees to the waiver terms above", MARGIN + 18, y + 58, { width: CONTENT_W - 60 });
      doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED)
        .text(`Signed: ${formatDate(waiver.signedAt!)}`, MARGIN + 18, y + 72);

      y += sigBoxH + 16;
    } else {
      const pendBoxH = 60;
      doc.roundedRect(MARGIN, y, CONTENT_W, pendBoxH, 8)
        .fill(PENDING_BG).stroke(PENDING_BORDER);
      doc.rect(MARGIN, y, 4, pendBoxH).fill(PENDING_ACCENT);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(PENDING_ACCENT).text("PENDING SUBCONTRACTOR SIGNATURE", MARGIN + 18, y + 12);
      doc.fontSize(9).font("Helvetica").fillColor(MUTED)
        .text("The subcontractor has not yet signed this conditional lien waiver.", MARGIN + 18, y + 30, { width: CONTENT_W - 40 });
      y += pendBoxH + 16;
    }

    // ── Legal notice ─────────────────────────────────────────────────────────
    const legalH = 50;
    doc.roundedRect(MARGIN, y, CONTENT_W, legalH, 6).fill(LIGHT_BG).stroke(BORDER);
    doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
      .text(
        "This document is a conditional waiver and release. It is effective only upon the claimant's receipt of full payment " +
        "for labor, services, equipment, or materials provided through the date listed herein. Until payment is received in full, " +
        "this document does not release or affect the claimant's lien rights or bond rights. Made in accordance with applicable state mechanic's lien laws.",
        MARGIN + 12, y + 8, { width: CONTENT_W - 24, lineGap: 2 }
      );

    y += legalH + 16;

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill(PRIMARY);
    doc.fontSize(8).font("Helvetica").fillColor("rgba(180,230,240,0.75)")
      .text(
        `SubDraw · Conditional Lien Waiver · Invoice #${waiver.invoiceNumber} · Generated ${formatDate(new Date())}`,
        MARGIN, PAGE_H - 22, { width: CONTENT_W, align: "center" }
      );

    doc.end();
  });
}
