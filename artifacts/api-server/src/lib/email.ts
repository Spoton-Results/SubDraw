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

const _resendBase = API_KEY ? new Resend(API_KEY) : null;
if (!API_KEY) console.log("[email] RESEND_API_KEY not set — emails will be skipped");

function isDemoEmail(email: string): boolean {
  return /^demo-.*@subtracker\.com$/.test(String(email));
}

const resend = _resendBase
  ? new Proxy(_resendBase, {
      get(target, prop) {
        if (prop === "emails") {
          return new Proxy((target as any).emails, {
            get(emailTarget, emailProp) {
              if (emailProp === "send") {
                return async (params: any) => {
                  const to = Array.isArray(params.to) ? params.to[0] : params.to;
                  if (isDemoEmail(String(to))) {
                    console.log(`[email] Skipping demo account email to: ${to}`);
                    return { data: { id: "demo-suppressed" }, error: null };
                  }
                  return (emailTarget as any).send(params);
                };
              }
              return (emailTarget as any)[emailProp];
            },
          });
        }
        return (target as any)[prop];
      },
    })
  : null;

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

// ─── 0. Magic link login email ────────────────────────────────────────────────
export async function sendMagicLinkEmail(opts: {
  toEmail: string;
  companyName: string;
  magicUrl: string;
}) {
  const html = layout(`
    ${heading("Your one-click login link")}
    ${subtext(`Hi <strong>${opts.companyName}</strong>, click the button below to log in instantly — no password needed.`)}
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1e40af;">This link expires in <strong>72 hours</strong> and can only be used once. If you didn't request this, you can safely ignore this email.</p>
    </div>
    ${ctaButton("Log in to SubTracker", opts.magicUrl)}
    <p style="margin-top:20px;font-size:12px;color:#94a3b8;">Or copy this link: <span style="color:#1e3a5f;">${opts.magicUrl}</span></p>
  `);
  await send(opts.toEmail, "Your SubTracker login link — click to enter", html);
}

// ─── 1. Sub invited to project ────────────────────────────────────────────────
export async function sendInviteEmail(opts: {
  toEmail: string;
  projectName: string;
  magicUrl: string;
  appUrl: string;
  tradeCategory?: string | null;
  tradeScope?: string | null;
  isConstructionPhase?: boolean;
}) {
  const scopeBlock = opts.tradeCategory && opts.tradeScope
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#14532d;">Scope of Work for This Bid — ${opts.tradeCategory}</p>
        <p style="margin:0;font-size:13px;color:#166534;white-space:pre-line;">${opts.tradeScope.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>`
    : "";
  const headingText = opts.isConstructionPhase
    ? "You've been invited to bid on additional scope"
    : "You've been invited to a project";
  const bodyText = opts.isConstructionPhase
    ? `You've been invited to submit a bid for additional scope on <strong>${opts.projectName}</strong>${opts.tradeCategory ? ` for the <strong>${opts.tradeCategory}</strong> trade` : ""}. This project is currently under construction — please review the scope and submit your proposed amount. Click below to log in instantly — no password needed.`
    : `You've been added as a subcontractor on <strong>${opts.projectName}</strong>${opts.tradeCategory ? ` for the <strong>${opts.tradeCategory}</strong> trade` : ""}. Click below to log in instantly — no password needed.`;
  const html = layout(`
    ${heading(headingText)}
    ${subtext(bodyText)}
    ${infoBox([
      { label: "Login Email", value: opts.toEmail },
      { label: "Project", value: opts.projectName },
      ...(opts.tradeCategory ? [{ label: "Trade", value: opts.tradeCategory }] : []),
    ])}
    ${scopeBlock}
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1e40af;">Your login link expires in <strong>72 hours</strong>. You can always request a new one from the login page.</p>
    </div>
    ${ctaButton("Log in to SubTracker", opts.magicUrl)}
  `);
  await send(opts.toEmail, `You've been invited to ${opts.projectName} on SubTracker`, html);
}

// ─── 2a. GC notified of new bid submission ────────────────────────────────────
export async function sendNewBidEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  projectName: string;
  subCompanyName: string;
  bidAmount: number;
  tradeCategory?: string | null;
  aiLow?: number | null;
  aiHigh?: number | null;
  appUrl: string;
}) {
  const { aiLow, aiHigh, bidAmount } = opts;
  let aiBlock = "";
  if (aiLow != null && aiHigh != null) {
    const isWithin = bidAmount >= aiLow && bidAmount <= aiHigh;
    const isAbove = bidAmount > aiHigh * 1.15;
    const isBelow = bidAmount < aiLow * 0.85;
    let rangeStatus = "";
    if (isAbove) rangeStatus = "⚠️ Above expected range (more than 15% above high estimate)";
    else if (isBelow) rangeStatus = "⚠️ Below expected range (more than 15% below low estimate — worth reviewing)";
    else rangeStatus = "✅ Within expected range";
    aiBlock = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0c4a6e;">AI Bid Benchmark</p>
      <p style="margin:0 0 4px;font-size:14px;color:#0369a1;">Range: ${formatCurrency(aiLow)} – ${formatCurrency(aiHigh)}</p>
      <p style="margin:0;font-size:13px;color:#075985;">${rangeStatus}</p>
    </div>`;
  }
  const html = layout(`
    ${heading("New bid submitted")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has submitted a bid on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      ...(opts.tradeCategory ? [{ label: "Trade", value: opts.tradeCategory }] : []),
      { label: "Bid Amount", value: formatCurrency(bidAmount) },
    ])}
    ${aiBlock}
    ${ctaButton("Review Bid", opts.appUrl)}
  `);
  await send(opts.toEmail, `New bid on ${opts.projectName} — ${opts.subCompanyName}`, html);
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
  gcCompanyName?: string;
  description: string;
  amount: number;
  subcontractUrl?: string;
  appUrl?: string;
}) {
  const ctaUrl = opts.subcontractUrl ?? opts.appUrl ?? "#";
  const fromLabel = opts.gcCompanyName ? ` from ${opts.gcCompanyName}` : "";
  const html = layout(`
    ${heading(`New Change Order${fromLabel}`)}
    ${subtext(`A new change order has been submitted for <strong>${opts.projectName}</strong> and is waiting for your review.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
    ])}
    ${ctaButton("Review Change Order", ctaUrl)}
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
  subcontractUrl?: string;
  appUrl?: string;
}) {
  const ctaUrl = opts.subcontractUrl ?? opts.appUrl ?? "#";
  const verb = opts.decision === "APPROVED" ? "approved" : "rejected";
  const headline = opts.decision === "APPROVED"
    ? `${opts.subCompanyName} approved a Change Order — your final approval is needed`
    : `${opts.subCompanyName} rejected a Change Order`;
  const html = layout(`
    ${heading(headline)}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has ${verb} the change order on <strong>${opts.projectName}</strong>${opts.decision === "APPROVED" ? ". Your final approval is required to proceed." : "."}`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
      { label: "Status", value: opts.decision === "APPROVED" ? "✅ Approved by Sub — Pending Your Approval" : "❌ Rejected" },
    ])}
    ${ctaButton(opts.decision === "APPROVED" ? "Review & Approve" : "View Details", ctaUrl)}
  `);
  await send(opts.toEmail, `Change order ${verb} on ${opts.projectName}`, html);
}

// ─── 4b. GC final-approved a change order — notify sub ───────────────────────
export async function sendChangeOrderGcFinalApprovalEmail(opts: {
  toEmail: string;
  projectName: string;
  gcCompanyName: string;
  description: string;
  amount: number;
  subcontractUrl?: string;
  appUrl?: string;
}) {
  const ctaUrl = opts.subcontractUrl ?? opts.appUrl ?? "#";
  const html = layout(`
    ${heading("Change Order Fully Approved")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has given final approval to the change order on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
      { label: "Status", value: "✅ Fully Approved" },
    ])}
    ${ctaButton("View Subcontract", ctaUrl)}
  `);
  await send(opts.toEmail, `Change order approved on ${opts.projectName}`, html);
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
  rejectionReason?: string;
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

  const rejectionBlock = opts.rejectionReason
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <p style="font-size:13px;font-weight:700;color:#dc2626;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.05em;">Reason for Rejection</p>
        <p style="font-size:15px;color:#7f1d1d;margin:0;line-height:1.5;">${opts.rejectionReason}</p>
      </div>
      <p style="font-size:13px;color:#64748b;margin-bottom:24px;">Please review the reason above, make the necessary corrections, and resubmit your invoice.</p>`
    : "";

  const html = layout(`
    ${heading(`Your invoice has been ${verb}`)}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has ${verb} your invoice on <strong>${opts.projectName}</strong>.${note}`)}
    ${opts.decision === "APPROVED" ? infoBox(rows) : warningBox(rows)}
    ${rejectionBlock}
    ${ctaButton("View Invoice & Resubmit", opts.appUrl)}
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
  tradeCategory?: string | null;
  tradeScope?: string | null;
  isConstructionPhase?: boolean;
}) {
  const scopeBlock = opts.tradeCategory && opts.tradeScope
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#14532d;">Scope of Work for This Bid — ${opts.tradeCategory}</p>
        <p style="margin:0;font-size:13px;color:#166534;white-space:pre-line;">${opts.tradeScope.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>`
    : "";
  const headingText = opts.isConstructionPhase
    ? "You've been invited to bid on additional scope"
    : "You've been added to a new project";
  const bodyText = opts.isConstructionPhase
    ? `<strong>${opts.subCompanyName}</strong>, you've been invited to submit a bid for additional scope on <strong>${opts.projectName}</strong>${opts.tradeCategory ? ` for the <strong>${opts.tradeCategory}</strong> trade` : ""}. This project is currently under construction — please review the scope and submit your proposed amount.`
    : `<strong>${opts.subCompanyName}</strong>, you have been invited to join the project <strong>${opts.projectName}</strong> on SubTracker${opts.tradeCategory ? ` for the <strong>${opts.tradeCategory}</strong> trade` : ""}.`;
  const html = layout(`
    ${heading(headingText)}
    ${subtext(bodyText)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      ...(opts.tradeCategory ? [{ label: "Trade", value: opts.tradeCategory }] : []),
    ])}
    ${scopeBlock}
    ${ctaButton(opts.isConstructionPhase ? "View Project & Submit Bid" : "View Project", opts.appUrl)}
  `);
  await send(opts.toEmail, `You've been invited to ${opts.projectName} on SubTracker`, html);
}

// ─── 10. Sub created a change order (notify GC) ───────────────────────────────
export async function sendChangeOrderSubmittedBySubEmail(opts: {
  toEmail: string;
  projectName: string;
  subCompanyName: string;
  description: string;
  amount: number;
  subcontractUrl?: string;
  appUrl?: string;
}) {
  const ctaUrl = opts.subcontractUrl ?? opts.appUrl ?? "#";
  const html = layout(`
    ${heading(`${opts.subCompanyName} submitted a Change Order`)}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has submitted a change order on <strong>${opts.projectName}</strong> that requires your review.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Description", value: opts.description },
      { label: "Amount", value: formatCurrency(opts.amount) },
    ])}
    ${ctaButton("Review Change Order", ctaUrl)}
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

// ─── 14. Insurance expiry warning (30 days) — notify GC ──────────────────────
export async function sendInsuranceExpiryWarningEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const html = layout(`
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#b45309;">⚠ Insurance Expiring in ${opts.daysUntilExpiry} Days</p>
    </div>
    ${heading("Subcontractor Insurance Expiring Soon")}
    ${subtext(`The insurance certificate for <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> will expire in <strong>${opts.daysUntilExpiry} days</strong>. Please request an updated certificate before it expires.`)}
    ${infoBox([
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Project", value: opts.projectName },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: `${opts.daysUntilExpiry} days` },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Insurance expiring in ${opts.daysUntilExpiry} days — ${opts.subCompanyName} on ${opts.projectName}`, html);
}

// ─── 15. Insurance urgent expiry alert (7 days) — notify GC ──────────────────
export async function sendInsuranceUrgentExpiryEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const html = layout(`
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">🚨 URGENT: Insurance Expiring in ${opts.daysUntilExpiry} Day${opts.daysUntilExpiry !== 1 ? "s" : ""}</p>
    </div>
    ${heading("Urgent: Insurance Certificate Expiring")}
    ${subtext(`The insurance certificate for <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> is expiring in <strong>${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""}</strong>. Immediately request an updated certificate and halt invoice approvals until coverage is confirmed.`)}
    ${warningBox([
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Project", value: opts.projectName },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: `${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""}` },
    ])}
    ${ctaButton("Update Insurance Now", opts.appUrl)}
  `);
  await send(opts.toEmail, `URGENT: Insurance expiring in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""} — ${opts.subCompanyName}`, html);
}

// ─── 16. License expiry warning (30 days) — notify GC ────────────────────────
export async function sendLicenseExpiryWarningEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  licenseType: string;
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const html = layout(`
    <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#b45309;">⚠ Contractor License Expiring in ${opts.daysUntilExpiry} Days</p>
    </div>
    ${heading("Contractor License Expiring Soon")}
    ${subtext(`The contractor license for <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> will expire in <strong>${opts.daysUntilExpiry} days</strong>. Please ensure their license is renewed before it expires.`)}
    ${infoBox([
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Project", value: opts.projectName },
      { label: "License Type", value: opts.licenseType },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: `${opts.daysUntilExpiry} days` },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Contractor license expiring in ${opts.daysUntilExpiry} days — ${opts.subCompanyName} on ${opts.projectName}`, html);
}

export async function sendLicenseUrgentExpiryEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  licenseType: string;
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const html = layout(`
    <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:#dc2626;">🚨 URGENT: Contractor License Expiring in ${opts.daysUntilExpiry} Day${opts.daysUntilExpiry !== 1 ? "s" : ""}</p>
    </div>
    ${heading("Urgent: Contractor License Expiring")}
    ${subtext(`The contractor license for <strong>${opts.subCompanyName}</strong> on <strong>${opts.projectName}</strong> is expiring in <strong>${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""}</strong>. Take immediate action to ensure license renewal and protect project compliance.`)}
    ${warningBox([
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Project", value: opts.projectName },
      { label: "License Type", value: opts.licenseType },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: `${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""}` },
    ])}
    ${ctaButton("View Subcontract Now", opts.appUrl)}
  `);
  await send(opts.toEmail, `URGENT: Contractor license expiring in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry !== 1 ? "s" : ""} — ${opts.subCompanyName}`, html);
}

// ─── 17. Password reset email ──────────────────────────────────────────────────

// ─── 17. Team member invite ────────────────────────────────────────────────────
export async function sendTeamMemberInviteEmail(opts: {
  toEmail: string;
  fullName: string;
  companyName: string;
  magicUrl: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading(`You've been added to the ${opts.companyName} team`)}
    ${subtext(`Hi <strong>${opts.fullName}</strong>, you have been added to the <strong>${opts.companyName}</strong> team on SubTracker. Click below to log in instantly — no password needed.`)}
    ${infoBox([
      { label: "Login Email", value: opts.toEmail },
      { label: "Company", value: opts.companyName },
    ])}
    <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#1e40af;">Your login link expires in <strong>72 hours</strong>. You can always request a new one from the login page.</p>
    </div>
    ${ctaButton("Log in to SubTracker", opts.magicUrl)}
  `);
  await send(opts.toEmail, `You have been added to ${opts.companyName} team on SubTracker`, html);
}

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

export async function sendContractReadyEmail(opts: {
  toEmail: string;
  subCompanyName: string;
  gcCompanyName: string;
  projectName: string;
  fileName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Your subcontract agreement is ready to review and sign")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has uploaded a subcontract agreement for <strong>${opts.projectName}</strong>. Please download, review, sign it, and upload your signed copy.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Document", value: opts.fileName },
      { label: "Next Step", value: "Download, sign, and upload your signed copy" },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Subcontract agreement ready for ${opts.projectName} — signature required`, html);
}

export async function sendContractSignedEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  fileName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Subcontractor uploaded signed agreement")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has uploaded their signed subcontract agreement for <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Document", value: opts.fileName },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Signed subcontract received from ${opts.subCompanyName} on ${opts.projectName}`, html);
}

export async function sendCommentNotificationEmail(opts: {
  toEmail: string;
  projectName: string;
  senderCompanyName: string;
  senderRole: string;
  messagePreview: string;
  appUrl: string;
}) {
  const roleLabel = opts.senderRole === "GC" ? "your General Contractor" : "your subcontractor";
  const html = layout(`
    ${heading("New message on your subcontract")}
    ${subtext(`<strong>${opts.senderCompanyName}</strong> (${roleLabel}) left a message on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "From", value: `${opts.senderCompanyName} (${opts.senderRole})` },
      { label: "Message", value: opts.messagePreview.length > 200 ? opts.messagePreview.substring(0, 200) + "…" : opts.messagePreview },
    ])}
    ${ctaButton("View Message", opts.appUrl)}
  `);
  await send(opts.toEmail, `New message from ${opts.senderCompanyName} on ${opts.projectName}`, html);
}

// ─── Owner CO notification ────────────────────────────────────────────────────
export async function sendOwnerCoNotificationEmail(opts: {
  toEmail: string;
  ownerName: string;
  gcCompanyName: string;
  projectName: string;
  projectAddress: string | null;
  coDescription: string;
  coAmount: number;
  previousBudget: number;
  newBudget: number;
  approveUrl: string;
  rejectUrl: string;
}) {
  const budgetChange = opts.newBudget - opts.previousBudget;
  const isIncrease = budgetChange > 0;
  const html = layout(`
    ${heading("Change Order Notification")}
    ${subtext(`Dear <strong>${opts.ownerName}</strong>, a change order has been issued on <strong>${opts.projectName}</strong> by <strong>${opts.gcCompanyName}</strong> that requires your awareness.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName + (opts.projectAddress ? ` — ${opts.projectAddress}` : "") },
      { label: "General Contractor", value: opts.gcCompanyName },
      { label: "Change Order", value: opts.coDescription },
      { label: "CO Amount", value: formatCurrency(opts.coAmount) },
      { label: "Previous Budget", value: formatCurrency(opts.previousBudget) },
      { label: "New Budget", value: formatCurrency(opts.newBudget) },
      { label: "Budget Impact", value: `${isIncrease ? "+" : ""}${formatCurrency(budgetChange)} (${isIncrease ? "increase" : "decrease"})` },
    ])}
    <p style="margin:0 0 12px;font-size:15px;color:#475569;">Please review this change order and indicate your response below. Your reply will be recorded for the project record.</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding-right:12px;">
          <a href="${opts.approveUrl}" style="display:inline-block;background:#15803d;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">✓ Approve Change Order</a>
        </td>
        <td>
          <a href="${opts.rejectUrl}" style="display:inline-block;background:#b91c1c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">✗ Reject Change Order</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:12px;color:#94a3b8;">If you believe you received this email in error, please contact your General Contractor directly. These links are unique to this notification and expire when acted upon.</p>
  `);
  await send(
    opts.toEmail,
    `Change Order Notification — ${opts.projectName}: ${opts.coDescription} (${formatCurrency(opts.coAmount)})`,
    html
  );
}

// ─── Owner CO reply confirmation ──────────────────────────────────────────────
export function buildOwnerReplyPage(opts: {
  ownerName: string;
  projectName: string;
  coDescription: string;
  action: "APPROVED" | "REJECTED";
}): string {
  const isApproved = opts.action === "APPROVED";
  const color = isApproved ? "#15803d" : "#b91c1c";
  const icon = isApproved ? "✓" : "✗";
  const verb = isApproved ? "approved" : "rejected";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:60px 0;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
          <tr><td style="background:#1e3a5f;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">⚙ SubTracker</span>
          </td></tr>
          <tr><td style="padding:40px 32px;text-align:center;">
            <div style="width:64px;height:64px;border-radius:50%;background:${color};display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
              <span style="color:#fff;font-size:28px;font-weight:700;">${icon}</span>
            </div>
            <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">Change Order ${opts.action === "APPROVED" ? "Approved" : "Rejected"}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;">Thank you, <strong>${opts.ownerName}</strong>. You have <strong>${verb}</strong> the change order "<em>${opts.coDescription}</em>" on <strong>${opts.projectName}</strong>.</p>
            <p style="margin:0;font-size:14px;color:#64748b;">Your response has been recorded and the General Contractor has been notified. You may close this window.</p>
          </td></tr>
          <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Powered by SubTracker — Construction Project Management</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// ─── Compliance notifications ─────────────────────────────────────────────────

export async function sendComplianceDocUploadedEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  itemTitle: string;
  documentName: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Compliance document submitted")}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has uploaded a compliance document on <strong>${opts.projectName}</strong> for your review.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Requirement", value: opts.itemTitle },
      { label: "Subcontractor", value: opts.subCompanyName },
      { label: "Document", value: opts.documentName },
    ])}
    <p style="font-size:13px;color:#64748b;margin-bottom:24px;">Please review the document and either approve it or request a revision with your feedback.</p>
    ${ctaButton("Review Compliance", opts.appUrl)}
  `);
  await send(opts.toEmail, `Compliance document submitted by ${opts.subCompanyName} on ${opts.projectName}`, html);
}

export async function sendComplianceApprovedEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  itemTitle: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Compliance document approved")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has approved your compliance document on <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Requirement", value: opts.itemTitle },
      { label: "Status", value: "Approved" },
    ])}
    ${ctaButton("View Subcontract", opts.appUrl)}
  `);
  await send(opts.toEmail, `Compliance approved: ${opts.itemTitle} on ${opts.projectName}`, html);
}

export async function sendComplianceRevisionEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  subCompanyName: string;
  projectName: string;
  itemTitle: string;
  revisionNote: string;
  appUrl: string;
}) {
  const html = layout(`
    ${heading("Revision requested on compliance document")}
    ${subtext(`<strong>${opts.gcCompanyName}</strong> has reviewed your compliance document on <strong>${opts.projectName}</strong> and is requesting a revision.`)}
    ${warningBox([
      { label: "Project", value: opts.projectName },
      { label: "Requirement", value: opts.itemTitle },
      { label: "Status", value: "Revision Needed" },
    ])}
    <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin:0 0 24px 0;">
      <p style="font-size:13px;font-weight:700;color:#dc2626;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:0.05em;">GC Feedback</p>
      <p style="font-size:15px;color:#7f1d1d;margin:0;line-height:1.5;">${opts.revisionNote}</p>
    </div>
    <p style="font-size:13px;color:#64748b;margin-bottom:24px;">Please review the feedback above and re-upload a corrected document.</p>
    ${ctaButton("Re-Upload Document", opts.appUrl)}
  `);
  await send(opts.toEmail, `Revision requested: ${opts.itemTitle} on ${opts.projectName}`, html);
}

export async function sendGCCredentialExpiryWarningEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  projectName: string;
  credentialType: "insurance" | "license";
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const typeLabel = opts.credentialType === "insurance" ? "Insurance Certificate" : "Contractor License";
  const html = layout(`
    ${heading(`Your ${typeLabel} is expiring soon`)}
    ${subtext(`Your ${typeLabel.toLowerCase()} for <strong>${opts.projectName}</strong> expires in <strong>${opts.daysUntilExpiry} days</strong>. Please renew and update your credentials before it expires.`)}
    ${warningBox([
      { label: "Project", value: opts.projectName },
      { label: "Credential", value: typeLabel },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: String(opts.daysUntilExpiry) },
    ])}
    ${ctaButton("Update Credentials", opts.appUrl)}
  `);
  await send(opts.toEmail, `Action needed: Your ${typeLabel} expires in ${opts.daysUntilExpiry} days — ${opts.projectName}`, html);
}

export async function sendGCCredentialUrgentExpiryEmail(opts: {
  toEmail: string;
  gcCompanyName: string;
  projectName: string;
  credentialType: "insurance" | "license";
  expirationDate: string;
  daysUntilExpiry: number;
  appUrl: string;
}) {
  const typeLabel = opts.credentialType === "insurance" ? "Insurance Certificate" : "Contractor License";
  const html = layout(`
    ${heading(`Urgent: Your ${typeLabel} expires in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry === 1 ? "" : "s"}`)}
    ${subtext(`Your ${typeLabel.toLowerCase()} for <strong>${opts.projectName}</strong> is expiring very soon. Update your credentials immediately to avoid disruption.`)}
    ${warningBox([
      { label: "Project", value: opts.projectName },
      { label: "Credential", value: typeLabel },
      { label: "Expiration Date", value: opts.expirationDate },
      { label: "Days Remaining", value: String(opts.daysUntilExpiry) },
    ])}
    ${ctaButton("Update Credentials Now", opts.appUrl)}
  `);
  await send(opts.toEmail, `URGENT: Your ${typeLabel} expires in ${opts.daysUntilExpiry} day${opts.daysUntilExpiry === 1 ? "" : "s"} — ${opts.projectName}`, html);
}


// ─── Admin message email ───────────────────────────────────────────────────────
export async function sendAdminMessageEmail(opts: {
  toEmail: string;
  subject: string;
  message: string;
}) {
  const html = layout(`
    ${heading(opts.subject)}
    ${subtext(opts.message)}
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">This message was sent by the SubTracker admin team.</p>
  `);
  await send(opts.toEmail, opts.subject, html);
}

// ─── Account cancelled (admin-initiated) email ────────────────────────────────
export async function sendAccountCancelledEmail(opts: {
  toEmail: string;
  companyName: string;
}) {
  const html = layout(`
    ${heading("Your SubTracker subscription has been cancelled")}
    ${subtext(`Hi ${opts.companyName},`)}
    ${subtext("Your SubTracker subscription has been cancelled. Your account data will be preserved in read-only mode for 90 days, after which it will be permanently deleted.")}
    ${subtext("If you believe this is in error or have any questions, please contact support.")}
  `);
  await send(opts.toEmail, "Your SubTracker subscription has been cancelled", html);
}

// ─── Submittal: GC sends a submittal to sub ────────────────────────────────────
export async function sendSubmittalCreatedEmail(opts: {
  toEmail: string;
  submittalName: string;
  projectName: string;
  gcCompanyName: string;
  openingMessage?: string | null;
  requiredResponseDate?: string | null;
  submittalUrl: string;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Project", value: opts.projectName },
    { label: "From", value: opts.gcCompanyName },
    { label: "Submittal", value: opts.submittalName },
  ];
  if (opts.requiredResponseDate) rows.push({ label: "Response Required By", value: opts.requiredResponseDate });
  const html = layout(`
    ${heading(`New Submittal from ${opts.gcCompanyName}`)}
    ${subtext(`You have received a new submittal on <strong>${opts.projectName}</strong> that requires your review.`)}
    ${infoBox(rows)}
    ${opts.openingMessage ? `<div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:6px;font-size:14px;color:#374151;">${opts.openingMessage}</div>` : ""}
    ${ctaButton("View & Respond", opts.submittalUrl)}
  `);
  await send(opts.toEmail, `New submittal: ${opts.submittalName} — review required`, html);
}

// ─── Submittal: someone replied ────────────────────────────────────────────────
export async function sendSubmittalReplyEmail(opts: {
  toEmail: string;
  submittalName: string;
  projectName: string;
  senderName: string;
  senderRole: "GC" | "SUB";
  messagePreview?: string | null;
  hasDocument: boolean;
  submittalUrl: string;
}) {
  const roleLabel = opts.senderRole === "GC" ? "General Contractor" : "Subcontractor";
  const whatHappened = opts.hasDocument && opts.messagePreview
    ? "sent a message and uploaded a document"
    : opts.hasDocument
    ? "uploaded a document"
    : "sent a message";
  const html = layout(`
    ${heading(`New Reply on "${opts.submittalName}"`)}
    ${subtext(`<strong>${opts.senderName}</strong> (${roleLabel}) ${whatHappened} on the submittal for <strong>${opts.projectName}</strong>.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Submittal", value: opts.submittalName },
      { label: "From", value: opts.senderName },
    ])}
    ${opts.messagePreview ? `<div style="margin:16px 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:6px;font-size:14px;color:#374151;">"${opts.messagePreview}"</div>` : ""}
    ${ctaButton("View Thread", opts.submittalUrl)}
  `);
  await send(opts.toEmail, `New reply on submittal: ${opts.submittalName}`, html);
}

// ─── Submittal: sub formally acknowledged ─────────────────────────────────────
export async function sendSubmittalAcknowledgedEmail(opts: {
  toEmail: string;
  submittalName: string;
  projectName: string;
  subCompanyName: string;
  acknowledgmentMessage?: string | null;
  acknowledgedAt: string;
  submittalUrl: string;
}) {
  const html = layout(`
    ${heading(`Submittal Acknowledged by ${opts.subCompanyName}`)}
    ${subtext(`<strong>${opts.subCompanyName}</strong> has formally acknowledged the submittal on <strong>${opts.projectName}</strong>. This acknowledgment is permanently timestamped.`)}
    ${infoBox([
      { label: "Project", value: opts.projectName },
      { label: "Submittal", value: opts.submittalName },
      { label: "Acknowledged By", value: opts.subCompanyName },
      { label: "Acknowledged At", value: new Date(opts.acknowledgedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) },
    ])}
    ${opts.acknowledgmentMessage ? `<div style="margin:16px 0;padding:12px 16px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:6px;font-size:14px;color:#374151;">"${opts.acknowledgmentMessage}"</div>` : ""}
    ${ctaButton("View Submittal", opts.submittalUrl)}
  `);
  await send(opts.toEmail, `Submittal acknowledged: ${opts.submittalName}`, html);
}
