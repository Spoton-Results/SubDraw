import { Resend } from "resend";

const API_KEY = process.env.RESEND_API_KEY;
const RAW_FROM = (process.env.RESEND_FROM_EMAIL || "").trim();

// Ensure FROM_EMAIL is a valid Resend "from" address.
// If the env var is just a domain like "reply.spotonresults.com", construct a default address.
function buildFromEmail(raw: string): string {
  if (!raw) return "SubTracker <noreply@reply.spotonresults.com>";
  // Already looks like a valid email or "Name <email>" form
  if (raw.includes("@")) return raw;
  // Raw value is just a domain — prepend a default localpart
  return `SubTracker <noreply@${raw}>`;
}

const FROM_EMAIL = buildFromEmail(RAW_FROM);

const resend = API_KEY ? new Resend(API_KEY) : null;
if (!API_KEY) console.log("[email] RESEND_API_KEY not set — emails will be skipped");

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

interface Attachment {
  content: string;
  filename: string;
  type: string;
}

async function send(to: string, subject: string, html: string, attachments?: Attachment[]) {
  if (!resend) {
    console.log(`[email] Resend not configured — would have sent to ${to}: ${subject}`);
    return;
  }
  try {
    const payload: any = { from: FROM_EMAIL, to, subject, html };
    if (attachments?.length) payload.attachments = attachments;
    const { error } = await resend.emails.send(payload);
    if (error) console.error("[email] Resend error:", error);
  } catch (err: any) {
    console.error("[email] Resend send error:", err);
  }
}

function pdfAttachment(buffer: Buffer, invoiceNumber: string): Attachment {
  return {
    content: buffer.toString("base64"),
    filename: `Invoice-${invoiceNumber}.pdf`,
    type: "application/pdf",
  };
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
  invoiceNumber: string;
  appUrl: string;
  pdfBuffer?: Buffer;
}) {
  const html = layout(`
    ${heading("New invoice submitted")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has submitted a new invoice on <strong>${opts.projectName}</strong>. The invoice PDF is attached for your records.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Invoice #", value: opts.invoiceNumber },
      { label: "Invoice Amount", value: formatCurrency(opts.amount) },
      { label: "Payment Terms", value: "Net 30" },
    ])}
    ${ctaButton("Review Invoice", opts.appUrl)}
  `);
  const attachments = opts.pdfBuffer ? [pdfAttachment(opts.pdfBuffer, opts.invoiceNumber)] : undefined;
  await send(opts.toEmail, `New invoice from ${opts.subCompanyName} on ${opts.projectName}`, html, attachments);
}

// ─── 6. Invoice flagged over approved amount ──────────────────────────────────
export async function sendInvoiceFlaggedEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  invoiceAmount: number;
  approvedTotal: number;
  overAmount: number;
  invoiceNumber: string;
  appUrl: string;
  pdfBuffer?: Buffer;
}) {
  const html = layout(`
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">Invoice Exceeds Approved Contract Amount</p>
    </div>
    ${heading("Flagged Invoice — Action Required")}
    ${subtext(`An invoice from <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> exceeds the approved contract amount. The invoice PDF is attached.`)}
    ${warningBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Invoice #", value: opts.invoiceNumber },
      { label: "Invoice Amount", value: formatCurrency(opts.invoiceAmount) },
      { label: "Approved Total", value: formatCurrency(opts.approvedTotal) },
      { label: "Exceeds By", value: formatCurrency(opts.overAmount) },
    ])}
    ${ctaButton("Review & Override", opts.appUrl)}
  `);
  const attachments = opts.pdfBuffer ? [pdfAttachment(opts.pdfBuffer, opts.invoiceNumber)] : undefined;
  await send(opts.toEmail, `Flagged invoice on ${opts.projectName} — exceeds approved amount`, html, attachments);
}

// ─── 7. GC approved or rejected an invoice ────────────────────────────────────
export async function sendInvoiceDecisionEmail(opts: {
  toEmail: string;
  projectName: string;
  gcCompanyName: string;
  amount: number;
  invoiceNumber: string;
  decision: "APPROVED" | "REJECTED";
  overrideReason?: string;
  appUrl: string;
  pdfBuffer?: Buffer;
}) {
  const verb = opts.decision === "APPROVED" ? "approved" : "rejected";
  const rows: { label: string; value: string }[] = [
    { label: "Project", value: opts.projectName },
    { label: "Invoice #", value: opts.invoiceNumber },
    { label: "Invoice Amount", value: formatCurrency(opts.amount) },
    { label: "Decision", value: opts.decision === "APPROVED" ? "Approved" : "Rejected" },
    { label: "Payment Terms", value: "Net 30" },
  ];
  if (opts.overrideReason) {
    rows.push({ label: "Override Note", value: opts.overrideReason });
  }
  const note = opts.decision === "APPROVED"
    ? " The approved invoice PDF is attached for your records."
    : "";
  const html = layout(`
    ${heading(`Your invoice has been ${verb}`)}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has ${verb} your invoice on <strong>${opts.projectName}</strong>.${note}`)}
    ${opts.decision === "APPROVED" ? infoBox(rows) : warningBox(rows)}
    ${ctaButton("View Invoice", opts.appUrl)}
  `);
  const attachments = opts.pdfBuffer ? [pdfAttachment(opts.pdfBuffer, opts.invoiceNumber)] : undefined;
  await send(opts.toEmail, `Invoice ${verb} on ${opts.projectName}`, html, attachments);
}

// ─── 8. Sub removed from project ──────────────────────────────────────────────
export async function sendSubRemovedEmail(opts: {
  toEmail: string;
  subCompanyName: string;
  gcCompanyName: string;
  projectName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("You have been removed from a project")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has removed <strong>${opts.subCompanyName}</strong> from the project <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "General Contractor", value: opts.gcCompanyName },
    ])}
    <p style="font-size:13px;color:#64748b;margin-bottom:24px;">Any pending bids you had on this project have been cancelled. If you believe this was a mistake, please contact the GC directly.</p>
    ${ctaButton("Log in to SubTracker", opts.appUrl)}
  `);
  await send(opts.toEmail, `You've been removed from ${opts.projectName} on SubTracker`, html);
}

// ─── 9. Existing sub added to a new project ───────────────────────────────────
export async function sendAddedToProjectEmail(opts: {
  toEmail: string;
  subCompanyName: string;
  projectName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("You've been added to a new project")}
    ${subtext(`<strong>${opts.subCompanyName}</strong>, you have been invited to join the project <strong>${opts.projectName}</strong> on SubTracker.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
    ])}
    ${ctaButton("View Project", opts.appUrl)}
  `);
  await send(opts.toEmail, `You've been added to ${opts.projectName} on SubTracker`, html);
}

// ─── 10. Sub created a change order (notify GC) ───────────────────────────────
export async function sendChangeOrderSubmittedBySubEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  description: string;
  amount: number;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("New change order submitted by subcontractor")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has submitted a change order on <strong>${opts.projectName}</strong> that requires your review.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
    ])}
    ${ctaButton("Review Change Order", opts.appUrl)}
  `);
  await send(opts.toEmail, `New change order from ${opts.subCompanyName} on ${opts.projectName}`, html);
}

// ─── 11. GC recorded payment — sub needs to confirm ───────────────────────────
export async function sendPaymentRecordedEmail(opts: {
  toEmail: string;
  projectName: string;
  gcCompanyName: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  paymentReference?: string;
  appUrl: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Project", value: opts.projectName },
    { label: "Invoice #", value: opts.invoiceNumber },
    { label: "Amount", value: formatCurrency(opts.amount) },
    { label: "Payment Date", value: opts.paymentDate },
    { label: "Payment Method", value: opts.paymentMethod },
  ];
  if (opts.paymentReference) rows.push({ label: "Reference #", value: opts.paymentReference });
  const html = layout(`
    ${heading("Payment recorded — please confirm receipt")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has recorded a payment for your invoice on <strong>${opts.projectName}</strong>. Please log in to confirm or dispute that you received this payment.`)}
    ${infoBox(rows)}
    ${ctaButton("Confirm or Dispute Payment", opts.appUrl)}
  `);
  await send(opts.toEmail, `Payment recorded for invoice #${opts.invoiceNumber} — action required`, html);
}

// ─── 12. Sub confirmed payment — notify GC ────────────────────────────────────
export async function sendPaymentConfirmedEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  invoiceNumber: string;
  amount: number;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Payment confirmed by subcontractor")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has confirmed receipt of payment for invoice #${opts.invoiceNumber} on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Invoice #", value: opts.invoiceNumber },
      { label: "Amount", value: formatCurrency(opts.amount) },
      { label: "Status", value: "✅ Payment Confirmed" },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Payment confirmed by ${opts.subCompanyName} on ${opts.projectName}`, html);
}

// ─── 13. Sub disputed payment — notify GC ─────────────────────────────────────
export async function sendPaymentDisputedEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  invoiceNumber: string;
  amount: number;
  disputeReason?: string;
  appUrl: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Project", value: opts.projectName },
    { label: "Subcontractor", value: opts.subCompanyName },
    { label: "Invoice #", value: opts.invoiceNumber },
    { label: "Amount", value: formatCurrency(opts.amount) },
  ];
  if (opts.disputeReason) rows.push({ label: "Dispute Reason", value: opts.disputeReason });
  const html = layout(`
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">Payment Dispute — Action Required</p>
    </div>
    ${heading("Subcontractor disputed payment receipt")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has disputed that they received payment for invoice #${opts.invoiceNumber} on <strong>${opts.projectName}</strong>. Please investigate and resolve this dispute.`)}
    ${warningBox(rows)}
    ${ctaButton("Resolve Dispute", opts.appUrl)}
  `);
  await send(opts.toEmail, `Payment disputed by ${opts.subCompanyName} on ${opts.projectName}`, html);
}

// ─── 14. Password reset email ──────────────────────────────────────────────────
export async function sendPasswordResetEmail(opts: {
  toEmail: string;
  companyName: string;
  resetUrl: string;
}) {
  const html = layout(`
    ${heading("Reset your password")}
    ${subtext(`Hi <strong>${opts.companyName}</strong>, we received a request to reset your SubTracker password.`)}
    ${subtext("Click the button below to set a new password. This link expires in <strong>1 hour</strong>.")}
    ${ctaButton("Reset Password", opts.resetUrl)}
    ${subtext("If you didn't request this, you can safely ignore this email. Your password will not change.")}
  `);
  await send(opts.toEmail, "Reset your SubTracker password", html);
}
