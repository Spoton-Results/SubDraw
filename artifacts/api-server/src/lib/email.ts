import sgMail from "@sendgrid/mail";

const API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@subtracker.app";

if (API_KEY) {
  sgMail.setApiKey(API_KEY);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f1f5f9;
  margin: 0; padding: 0;
`;

function layout(content: string) {
  return `<!DOCTYPE html><html><body style="${BASE_STYLE}">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1e3a5f;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">⚙ SubTracker</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message from SubTracker. Please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function heading(text: string) {
  return `<h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${text}</h2>`;
}

function subtext(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;color:#475569;">${text}</p>`;
}

function infoBox(rows: { label: string; value: string }[]) {
  const items = rows.map(r => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;width:160px;">${r.label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#0f172a;font-weight:600;">${r.value}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">${items}</table>`;
}

function warningBox(rows: { label: string; value: string }[]) {
  const items = rows.map(r => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#991b1b;width:160px;">${r.label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#7f1d1d;font-weight:600;">${r.value}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">${items}</table>`;
}

function ctaButton(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:#1e3a5f;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

async function send(to: string, subject: string, html: string) {
  if (!API_KEY) {
    console.log(`[email] SendGrid not configured — would have sent to ${to}: ${subject}`);
    return;
  }
  try {
    await sgMail.send({ from: FROM_EMAIL, to, subject, html });
  } catch (err: any) {
    console.error("[email] SendGrid error:", err?.response?.body ?? err);
  }
}

// ─── 1. Sub invited to project ────────────────────────────────────────────────
export async function sendInviteEmail(opts: {
  toEmail: string;
  temporaryPassword: string;
  projectName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("You've been invited to a project")}
    ${subtext(`You've been added as a subcontractor on <strong>${opts.projectName}</strong>. Use the credentials below to log in.`)}
    ${infoBox([
      { label: "Login Email", value: opts.toEmail },
      { label: "Temporary Password", value: `<code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:15px;font-family:monospace;">${opts.temporaryPassword}</code>` },
      { label: "Project", value: opts.projectName },
    ])}
    <p style="font-size:13px;color:#64748b;margin-bottom:24px;">You will be asked to set a new password when you first log in.</p>
    ${ctaButton("Log in to SubTracker", opts.appUrl)}
  `);
  await send(opts.toEmail, `You've been invited to ${opts.projectName} on SubTracker`, html);
}

// ─── 2. Sub's bid awarded ──────────────────────────────────────────────────────
export async function sendBidAwardedEmail(opts: {
  toEmail: string;
  subCompanyName: string;
  projectName: string;
  bidAmount: number;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Your bid has been accepted!")}
    ${subtext(`Congratulations! Your bid on <strong>${opts.projectName}</strong> has been accepted and a subcontract has been created.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Bid Amount", value: formatCurrency(opts.bidAmount) },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Your bid on ${opts.projectName} has been accepted`, html);
}

// ─── 3. GC created a change order ─────────────────────────────────────────────
export async function sendChangeOrderCreatedEmail(opts: {
  toEmail: string;
  projectName: string;
  description: string;
  amount: number;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("New change order requires your approval")}
    ${subtext(`A new change order has been submitted for <strong>${opts.projectName}</strong> and is waiting for your review.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
    ])}
    ${ctaButton("Review Change Order", opts.appUrl)}
  `);
  await send(opts.toEmail, `New change order on ${opts.projectName} — review required`, html);
}

// ─── 4. Sub approved or rejected a change order ───────────────────────────────
export async function sendChangeOrderDecisionEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  description: string;
  amount: number;
  decision: "APPROVED" | "REJECTED";
  appUrl: string;
}) {
  const verb = opts.decision === "APPROVED" ? "approved" : "rejected";
  const html = layout(`
    ${heading(`Change order ${verb} by subcontractor`)}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has ${verb} the change order on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
      { label: "Decision", value: opts.decision === "APPROVED" ? "✅ Approved" : "❌ Rejected" },
    ])}
    ${ctaButton("View Change Order", opts.appUrl)}
  `);
  await send(opts.toEmail, `Change order ${verb} on ${opts.projectName}`, html);
}

// ─── 5. Sub submitted an invoice ──────────────────────────────────────────────
export async function sendInvoiceSubmittedEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  amount: number;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("New invoice submitted")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has submitted a new invoice on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Invoice Amount", value: formatCurrency(opts.amount) },
    ])}
    ${ctaButton("Review Invoice", opts.appUrl)}
  `);
  await send(opts.toEmail, `New invoice from ${opts.subCompanyName} on ${opts.projectName}`, html);
}

// ─── 6. Invoice flagged over approved amount ──────────────────────────────────
export async function sendInvoiceFlaggedEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  invoiceAmount: number;
  approvedTotal: number;
  overAmount: number;
  appUrl: string;
}) {
  const html = layout(`
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">⚠ Invoice Exceeds Approved Contract Amount</p>
    </div>
    ${heading("Flagged Invoice — Action Required")}
    ${subtext(`An invoice from <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> exceeds the approved contract amount.`)}
    ${warningBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Invoice Amount", value: formatCurrency(opts.invoiceAmount) },
      { label: "Approved Total", value: formatCurrency(opts.approvedTotal) },
      { label: "Exceeds By", value: formatCurrency(opts.overAmount) },
    ])}
    ${ctaButton("Review & Override", opts.appUrl)}
  `);
  await send(opts.toEmail, `⚠ Flagged invoice on ${opts.projectName} — exceeds approved amount`, html);
}

// ─── 7. GC approved or rejected an invoice ────────────────────────────────────
export async function sendInvoiceDecisionEmail(opts: {
  toEmail: string;
  projectName: string;
  gcCompanyName: string;
  amount: number;
  decision: "APPROVED" | "REJECTED";
  overrideReason?: string;
  appUrl: string;
}) {
  const verb = opts.decision === "APPROVED" ? "approved" : "rejected";
  const rows: { label: string; value: string }[] = [
    { label: "Project", value: opts.projectName },
    { label: "Invoice Amount", value: formatCurrency(opts.amount) },
    { label: "Decision", value: opts.decision === "APPROVED" ? "✅ Approved" : "❌ Rejected" },
  ];
  if (opts.overrideReason) {
    rows.push({ label: "Note", value: opts.overrideReason });
  }
  const html = layout(`
    ${heading(`Your invoice has been ${verb}`)}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has ${verb} your invoice on <strong>${opts.projectName}</strong>.`)}
    ${infoBox(rows)}
    ${ctaButton("View Invoice", opts.appUrl)}
  `);
  await send(opts.toEmail, `Invoice ${verb} on ${opts.projectName}`, html);
}
