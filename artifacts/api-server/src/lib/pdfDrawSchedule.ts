import PDFDocument from "pdfkit";

const PRIMARY = "#1e3a5f";
const LIGHT_BG = "#f8fafc";
const BORDER = "#e2e8f0";
const MUTED = "#64748b";
const TEXT = "#0f172a";
const GREEN = "#16a34a";
const GREEN_BG = "#dcfce7";
const YELLOW = "#b45309";
const YELLOW_BG = "#fef9c3";
const RED = "#dc2626";
const RED_BG = "#fee2e2";
const TOTAL_BG = "#1e3a5f";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

export interface DrawScheduleItemData {
  description: string;
  budgetAmount: number;
  committed: number;
  linkedSubcontracts: { companyName: string; currentApprovedTotal: number }[];
}

export interface DrawSchedulePDFData {
  projectName: string;
  projectAddress?: string | null;
  gcCompanyName: string;
  generatedAt: Date;
  items: DrawScheduleItemData[];
}

export async function generateDrawSchedulePDF(data: DrawSchedulePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width - 100;
    const colWidths = [220, 90, 90, 90, 70, 115];
    const headers = ["Line Item", "Budget", "Committed", "Variance", "% Used", "Subcontracts"];

    function drawHeader() {
      doc.rect(50, 50, doc.page.width - 100, 70).fill(PRIMARY);
      doc.fill("#ffffff").fontSize(20).font("Helvetica-Bold").text("Bank Draw Schedule", 70, 65);
      doc.fontSize(9).font("Helvetica").text(data.gcCompanyName, 70, 92);

      const rightX = doc.page.width - 200;
      doc.fontSize(9).text(`Project: ${data.projectName}`, rightX, 65, { width: 180, align: "right" });
      if (data.projectAddress) {
        doc.text(data.projectAddress, rightX, 78, { width: 180, align: "right" });
      }
      doc.text(`Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, rightX, 91, { width: 180, align: "right" });
      doc.fill(TEXT);
    }

    function drawTableHeader(y: number) {
      let x = 50;
      doc.rect(50, y, pageW, 22).fill("#e2e8f0");
      doc.fill(PRIMARY).fontSize(8).font("Helvetica-Bold");
      headers.forEach((h, i) => {
        const align = i === 0 ? "left" : "right";
        const pad = i === 0 ? 6 : 4;
        doc.text(h, x + pad, y + 7, { width: colWidths[i] - 8, align });
        x += colWidths[i];
      });
      doc.fill(TEXT);
    }

    function drawRow(item: DrawScheduleItemData, y: number, isEven: boolean) {
      const variance = item.budgetAmount - item.committed;
      const pct = item.budgetAmount > 0 ? (item.committed / item.budgetAmount) * 100 : 0;

      let rowBg = isEven ? LIGHT_BG : "#ffffff";
      doc.rect(50, y, pageW, 28).fill(rowBg);

      let varColor: string;
      if (variance < 0) varColor = RED;
      else if (pct >= 90) varColor = YELLOW;
      else varColor = GREEN;

      let x = 50;

      doc.fill(TEXT).fontSize(9).font("Helvetica-Bold").text(item.description, x + 6, y + 6, { width: colWidths[0] - 12, ellipsis: true });

      const subNames = item.linkedSubcontracts.map(s => s.companyName).join(", ");
      if (subNames) {
        doc.fill(MUTED).fontSize(7).font("Helvetica").text(subNames, x + 6, y + 18, { width: colWidths[0] - 12, ellipsis: true });
      }

      x += colWidths[0];
      doc.fill(TEXT).fontSize(9).font("Helvetica").text(fmt(item.budgetAmount), x + 4, y + 11, { width: colWidths[1] - 8, align: "right" });
      x += colWidths[1];
      doc.text(fmt(item.committed), x + 4, y + 11, { width: colWidths[2] - 8, align: "right" });
      x += colWidths[2];
      doc.fill(varColor).text(fmt(variance), x + 4, y + 11, { width: colWidths[3] - 8, align: "right" });
      x += colWidths[3];
      doc.fill(pct > 100 ? RED : TEXT).text(fmtPct(pct), x + 4, y + 11, { width: colWidths[4] - 8, align: "right" });
      doc.fill(TEXT);

      doc.rect(50, y + 27, pageW, 1).fill(BORDER);
      doc.fill(TEXT);
    }

    function drawTotals(items: DrawScheduleItemData[], y: number) {
      const totalBudget = items.reduce((s, i) => s + i.budgetAmount, 0);
      const totalCommitted = items.reduce((s, i) => s + i.committed, 0);
      const totalVariance = totalBudget - totalCommitted;
      const totalPct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;

      doc.rect(50, y, pageW, 30).fill(TOTAL_BG);
      doc.fill("#ffffff").fontSize(9).font("Helvetica-Bold");

      let x = 50;
      doc.text("TOTAL", x + 6, y + 11, { width: colWidths[0] - 12 });
      x += colWidths[0];
      doc.text(fmt(totalBudget), x + 4, y + 11, { width: colWidths[1] - 8, align: "right" });
      x += colWidths[1];
      doc.text(fmt(totalCommitted), x + 4, y + 11, { width: colWidths[2] - 8, align: "right" });
      x += colWidths[2];
      const varColor = totalVariance < 0 ? "#fca5a5" : "#86efac";
      doc.fill(varColor).text(fmt(totalVariance), x + 4, y + 11, { width: colWidths[3] - 8, align: "right" });
      x += colWidths[3];
      doc.fill("#ffffff").text(fmtPct(totalPct), x + 4, y + 11, { width: colWidths[4] - 8, align: "right" });
      doc.fill(TEXT);
    }

    drawHeader();

    const tableStartY = 140;
    drawTableHeader(tableStartY);

    let curY = tableStartY + 22;

    data.items.forEach((item, idx) => {
      if (curY > doc.page.height - 120) {
        doc.addPage();
        drawTableHeader(50);
        curY = 72;
      }
      drawRow(item, curY, idx % 2 === 0);
      curY += 28;
    });

    if (curY > doc.page.height - 80) {
      doc.addPage();
      curY = 50;
    }

    drawTotals(data.items, curY);

    curY += 50;
    doc.fill(MUTED).fontSize(8).font("Helvetica")
      .text("This draw schedule is generated from SubTracker and reflects committed contract values including approved change orders.", 50, curY, { width: pageW, align: "center" });

    doc.end();
  });
}
