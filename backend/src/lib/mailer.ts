import nodemailer from "nodemailer";
import { env } from "../config/env";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export async function sendTempPasswordEmail(to: string, tempPassword: string): Promise<void> {
  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Your Cimun Card account has been created",
    html: `
      <p>Hi,</p>
      <p>An account has been created for you on Cimun Card. Your login email is <strong>${to}</strong>.</p>
      <p>Your temporary password is:</p>
      <p style="font-family: monospace; font-size: 18px; background: #f4f4f4; padding: 8px 12px; display: inline-block;">${tempPassword}</p>
      <p>Please log in and change this password &mdash; you will be required to set a new one on your first login. You can also change it anytime from your account page.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Reset your Cimun Card password",
    html: `
      <p>Hi,</p>
      <p>We received a request to reset the password for the account <strong>${to}</strong>.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BROADCAST_BATCH_SIZE = 40;

/**
 * Sends one message to many recipients via chunked BCC batches (one SMTP
 * transmission per batch rather than per recipient, so a few thousand
 * delegates doesn't mean a few thousand individual sends). Runs to
 * completion in the background; callers should not await this on a
 * request/response cycle for large recipient lists.
 */
export async function sendBroadcastEmail(
  recipients: string[],
  subject: string,
  message: string
): Promise<{ sent: number; failedBatches: number }> {
  const html = `<div style="white-space: pre-wrap; font-family: -apple-system, Arial, sans-serif; font-size: 15px; line-height: 1.5;">${escapeHtml(message)}</div>`;

  let sent = 0;
  let failedBatches = 0;

  for (let i = 0; i < recipients.length; i += BROADCAST_BATCH_SIZE) {
    const batch = recipients.slice(i, i + BROADCAST_BATCH_SIZE);
    try {
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: env.SMTP_FROM,
        bcc: batch,
        subject,
        html,
      });
      sent += batch.length;
    } catch (err) {
      failedBatches += 1;
      console.error(`Broadcast email batch ${i / BROADCAST_BATCH_SIZE + 1} failed:`, err);
    }
  }

  return { sent, failedBatches };
}
