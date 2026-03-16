import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

export interface InviteEmailOptions {
  toEmail: string;
  temporaryPassword: string;
  projectName: string;
  appUrl: string;
}

export async function sendInviteEmail(opts: InviteEmailOptions): Promise<void> {
  const { toEmail, temporaryPassword, projectName, appUrl } = opts;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
      <h2 style="color: #111827; margin-bottom: 8px;">You've been invited to SubTracker</h2>
      <p style="color: #6b7280;">You have been invited to collaborate on the project <strong style="color: #111827;">${projectName}</strong>.</p>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Your login credentials:</p>
        <p style="margin: 4px 0;"><strong>Email:</strong> ${toEmail}</p>
        <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:15px;">${temporaryPassword}</code></p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">You will be asked to set a new password when you first log in.</p>
      <a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">Log in to SubTracker</a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
    </div>
  `;

  const transport = createTransport();

  if (!transport) {
    console.log("[email] SMTP not configured — would have sent:");
    console.log(`  To: ${toEmail}`);
    console.log(`  Subject: You have been invited to SubTracker`);
    console.log(`  Project: ${projectName}`);
    console.log(`  Temp password: ${temporaryPassword}`);
    console.log(`  App URL: ${appUrl}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || `SubTracker <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "You have been invited to SubTracker",
    html,
  });
}
