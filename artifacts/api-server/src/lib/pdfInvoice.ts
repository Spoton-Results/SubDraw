import PDFDocument from "pdfkit";

const PRIMARY = "#1e3a5f";
const PRIMARY_LIGHT = "#2d5a8e";
const LIGHT_BG = "#f8fafc";
const BORDER = "#e2e8f0";
const MUTED = "#64748b";
const TEXT = "#0f172a";
const SUCCESS_BG = "#dcfce7";
const SUCCESS_TEXT = "#16a34a";
const DANGER_BG = "#fef2f2";
const DANGER_TEXT = "#dc2626";
const WARNING_BG = "#fffbeb";
const WARNING_TEXT = "#92400e";
const PENDING_BG = "#fefce8";
const PENDING_TEXT = "#854d0e";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(d));
}

export interface InvoicePDFData {
  invoice: {
    invoiceNumber: string;
    amount: number;
    description: string | null;
    status: string;
    flaggedOverAmount: number;
    overrideReason: string | null;
    createdAt: Date | string;
  };
  subcontract: {
    id: string;
    baseContractAmount: number;
    tradeCategory?: string | null;
  };
  project: {
    name: string;
    address?: string | null;
  };
  sub: {
    companyName: string;
    email: string;
  };
  gc: {
    companyName: string;
  };
  scoreboard: {
    base: number;
    coTotal: number;
    currentApprovedTotal: number;
    invoicedTotal: number;
    remaining: number;
  };
}

export function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { invoice, project, sub, gc, scoreboard } = data;

    const prevInvoiced =
      invoice.status === "APPROVED"
        ? scoreboard.invoicedTotal - invoice.amount
        : scoreboard.invoicedTotal;
    const balanceAfter = scoreboard.currentApprovedTotal - prevInvoiced - invoice.amount;

    const doc = new PDFDocument({
      size: "LETTER",
      margin: 0,
      info: {
        Title: `Invoice #${invoice.invoiceNumber}`,
        Author: "SubTracker",
        Subject: `Invoice for ${project.name}`,
        Creator: "SubTracker Platform",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;
    const MARGIN = 52;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ── Header Bar ───────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 76).fill(PRIMARY);

    // SubTracker logo text
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#ffffff").text("SubTracker", MARGIN, 20);
    doc.fontSize(9).font("Helvetica").fillColor("rgba(200,220,255,0.8)").text("Subcontract Management Platform", MARGIN, 44);

    // "INVOICE" label top-right
    doc.fontSize(10).font("Helvetica-Bold").fillColor("rgba(200,220,255,0.9)")
      .text("INVOICE", PAGE_W - MARGIN - 80, 22, { width: 80, align: "right" });
    doc.fontSize(8).font("Helvetica").fillColor("rgba(180,200,240,0.7)")
      .text(`#${invoice.invoiceNumber}`, PAGE_W - MARGIN - 80, 35, { width: 80, align: "right" });

    // ── Status stamp ────────────────────────────────────────────────────────────
    let stampFill: string;
    let stampTextColor: string;
    let stampLabel: string;

    if (invoice.status === "APPROVED") {
      stampFill = SUCCESS_BG; stampTextColor = SUCCESS_TEXT; stampLabel = "APPROVED";
    } else if (invoice.status === "REJECTED") {
      stampFill = DANGER_BG; stampTextColor = DANGER_TEXT; stampLabel = "REJECTED";
    } else if (invoice.status === "FLAGGED") {
      stampFill = DANGER_BG; stampTextColor = DANGER_TEXT; stampLabel = "FLAGGED";
    } else {
      stampFill = PENDING_BG; stampTextColor = PENDING_TEXT; stampLabel = "PENDING REVIEW";
    }

    let y = 96;

    // Large title + status side by side
    doc.fontSize(30).font("Helvetica-Bold").fillColor(TEXT).text("INVOICE", MARGIN, y);

    const stampW = 140;
    const stampH = 38;
    const stampX = PAGE_W - MARGIN - stampW;
    const stampY = y - 2;
    doc.roundedRect(stampX, stampY, stampW, stampH, 6).fill(stampFill);
    doc.roundedRect(stampX, stampY, stampW, stampH, 6).lineWidth(1.5).strokeColor(stampTextColor).stroke();
    doc.fontSize(11).font("Helvetica-Bold").fillColor(stampTextColor)
      .text(stampLabel, stampX, stampY + 13, { width: stampW, align: "center" });

    y += 50;

    // ── Thin accent line ─────────────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 2).fill(PRIMARY_LIGHT);
    y += 14;

    // ── Two-column header block ──────────────────────────────────────────────────
    const midX = MARGIN + CONTENT_W / 2 + 10;

    // Left side: FROM
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("FROM", MARGIN, y, { characterSpacing: 1 });
    y += 12;
    doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT).text(sub.companyName, MARGIN, y);
    y += 17;
    doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(sub.email, MARGIN, y);

    // Right side: invoice metadata
    const detailLabelX = midX;
    const detailValueX = PAGE_W - MARGIN - 130;
    let detailY = y - 29;

    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("INVOICE DETAILS", detailLabelX, detailY, { characterSpacing: 1 });
    detailY += 12;

    const metaRows = [
      ["Invoice Number:", `#${invoice.invoiceNumber}`],
      ["Date Issued:", formatDate(invoice.createdAt)],
      ["Payment Terms:", "Net 30"],
    ];

    for (const [label, val] of metaRows) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(label, detailLabelX, detailY);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT).text(val, detailValueX, detailY, { width: 130, align: "right" });
      detailY += 15;
    }

    y += 22;

    // ── Divider ──────────────────────────────────────────────────────────────────
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 16;

    // ── Bill To + Project ────────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("BILL TO", MARGIN, y, { characterSpacing: 1 });
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("PROJECT", midX, y, { characterSpacing: 1 });
    y += 12;

    doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT).text(gc.companyName, MARGIN, y);
    doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT).text(project.name, midX, y);
    y += 17;

    if (project.address) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(project.address, midX, y);
      y += 14;
    }

    if (subcontract.tradeCategory) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED).text(`Trade: ${subcontract.tradeCategory}`, midX, y);
      y += 14;
    }

    y += 10;

    // ── Divider ──────────────────────────────────────────────────────────────────
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 18;

    // ── Description section ──────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("DESCRIPTION OF WORK", MARGIN, y, { characterSpacing: 1 });
    y += 12;

    const descText = invoice.description || "No description provided.";
    const descColor = invoice.description ? TEXT : MUTED;
    doc.fontSize(10);
    const descLines = doc.heightOfString(descText, { width: CONTENT_W - 24 });
    const descBlockH = Math.max(40, descLines + 24);

    doc.roundedRect(MARGIN, y, CONTENT_W, descBlockH, 5).fill(LIGHT_BG);
    doc.rect(MARGIN, y, 3, descBlockH).fill(PRIMARY);
    doc.fontSize(10).font("Helvetica").fillColor(descColor)
      .text(descText, MARGIN + 14, y + 12, { width: CONTENT_W - 28 });
    y += descBlockH + 20;

    // ── Contract Summary Table ────────────────────────────────────────────────────
    doc.fontSize(7).font("Helvetica-Bold").fillColor(MUTED).text("CONTRACT SUMMARY", MARGIN, y, { characterSpacing: 1 });
    y += 12;

    const tableStartY = y;
    const ROW_H = 26;
    const labelPad = MARGIN + 16;
    const valX = PAGE_W - MARGIN - 16;

    const summaryRows: Array<{ label: string; value: number; bold?: boolean; muted?: boolean }> = [
      { label: "Base Contract Amount", value: scoreboard.base },
      { label: "Approved Change Orders", value: scoreboard.coTotal, muted: scoreboard.coTotal === 0 },
      { label: "Total Approved Contract", value: scoreboard.currentApprovedTotal, bold: true },
      { label: "Previously Invoiced", value: prevInvoiced, muted: prevInvoiced === 0 },
    ];

    for (let i = 0; i < summaryRows.length; i++) {
      const row = summaryRows[i];
      const rowY = y + i * ROW_H;
      doc.rect(MARGIN, rowY, CONTENT_W, ROW_H).fill(i % 2 === 0 ? LIGHT_BG : "#ffffff");

      const font = row.bold ? "Helvetica-Bold" : "Helvetica";
      const color = row.muted ? MUTED : TEXT;

      doc.fontSize(10).font(font).fillColor(color).text(row.label, labelPad, rowY + 8);
      doc.fontSize(10).font(font).fillColor(color)
        .text(formatCurrency(row.value), valX - 100, rowY + 8, { width: 100, align: "right" });
    }

    y += summaryRows.length * ROW_H;

    // Separator line
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(1).strokeColor(BORDER).stroke();

    // "This Invoice" highlighted row
    const thisInvRowH = 32;
    doc.rect(MARGIN, y, CONTENT_W, thisInvRowH).fill(PRIMARY);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#ffffff")
      .text("This Invoice", labelPad, y + 10);
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#ffffff")
      .text(formatCurrency(invoice.amount), valX - 120, y + 10, { width: 120, align: "right" });
    y += thisInvRowH;

    // Remaining balance row
    const isNegBal = balanceAfter < 0;
    const balBg = isNegBal ? "#fef2f2" : "#f0fdf4";
    const balColor = isNegBal ? DANGER_TEXT : SUCCESS_TEXT;
    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(balBg);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(balColor)
      .text("Remaining Balance After This Invoice", labelPad, y + 8);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(balColor)
      .text(formatCurrency(balanceAfter), valX - 100, y + 8, { width: 100, align: "right" });
    y += ROW_H;

    // Border around entire table
    const tableH = y - tableStartY;
    doc.roundedRect(MARGIN, tableStartY, CONTENT_W, tableH, 6)
      .lineWidth(1).strokeColor(BORDER).stroke();

    y += 20;

    // ── Amount Due box ────────────────────────────────────────────────────────────
    const amtBoxH = 54;
    doc.roundedRect(MARGIN, y, CONTENT_W, amtBoxH, 8).fill(PRIMARY);
    doc.fontSize(10).font("Helvetica-Bold").fillColor("rgba(200,220,255,0.8)")
      .text("TOTAL AMOUNT DUE", MARGIN + 20, y + 10);
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#ffffff")
      .text(formatCurrency(invoice.amount), MARGIN + 20, y + 23);

    // Payment terms on right side
    doc.fontSize(9).font("Helvetica-Bold").fillColor("rgba(200,220,255,0.7)")
      .text("Payment Terms", PAGE_W - MARGIN - 130, y + 12, { width: 120, align: "right" });
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#ffffff")
      .text("Net 30", PAGE_W - MARGIN - 130, y + 26, { width: 120, align: "right" });

    y += amtBoxH + 16;

    // ── Flagged warning ───────────────────────────────────────────────────────────
    if ((invoice.status === "FLAGGED" || invoice.status === "APPROVED") && invoice.flaggedOverAmount > 0) {
      const warnH = 50;
      doc.roundedRect(MARGIN, y, CONTENT_W, warnH, 6).fill(DANGER_BG);
      doc.roundedRect(MARGIN, y, CONTENT_W, warnH, 6).lineWidth(1).strokeColor("#fecaca").stroke();
      doc.rect(MARGIN, y, 4, warnH).fill(DANGER_TEXT);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(DANGER_TEXT)
        .text("WARNING: Invoice Exceeds Approved Contract Balance", MARGIN + 14, y + 10, { width: CONTENT_W - 28 });
      doc.fontSize(9).font("Helvetica").fillColor(DANGER_TEXT)
        .text(`Exceeds approved amount by ${formatCurrency(invoice.flaggedOverAmount)}`, MARGIN + 14, y + 27, { width: CONTENT_W - 28 });
      y += warnH + 12;
    }

    // ── Override reason ───────────────────────────────────────────────────────────
    if (invoice.overrideReason) {
      const overH = 50;
      doc.roundedRect(MARGIN, y, CONTENT_W, overH, 6).fill(WARNING_BG);
      doc.roundedRect(MARGIN, y, CONTENT_W, overH, 6).lineWidth(1).strokeColor("#fde68a").stroke();
      doc.rect(MARGIN, y, 4, overH).fill(WARNING_TEXT);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(WARNING_TEXT)
        .text("Override Approved — GC Note:", MARGIN + 14, y + 10);
      doc.fontSize(9).font("Helvetica").fillColor(WARNING_TEXT)
        .text(invoice.overrideReason, MARGIN + 14, y + 27, { width: CONTENT_W - 28 });
      y += overH + 12;
    }

    // ── Footer ────────────────────────────────────────────────────────────────────
    const footerY = PAGE_H - 48;
    doc.moveTo(MARGIN, footerY).lineTo(PAGE_W - MARGIN, footerY).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
      .text(
        `Generated by SubTracker on ${formatDate(new Date())}  |  This document is an official billing record.`,
        MARGIN, footerY + 10, { align: "center", width: CONTENT_W }
      );

    doc.end();
  });
}
