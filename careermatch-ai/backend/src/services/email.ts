import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

export interface Mail { to: string; subject: string; text: string; html: string; }

let transporter: Transporter | null = null;
/** Captured in test runs / inspectable in dev. */
export const outbox: Mail[] = [];

function getTransporter() {
  if (!transporter) {
    if (!env.SMTP_HOST) throw new Error("EMAIL_TRANSPORT=smtp requires SMTP_HOST (and usually SMTP_USER / SMTP_PASS)");
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE === "true",
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(mail: Mail) {
  outbox.push(mail);
  if (outbox.length > 50) outbox.shift();
  if (env.EMAIL_TRANSPORT === "console") {
    console.log(`\n=== [DEV EMAIL] ===\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n===================\n`);
    return;
  }
  await getTransporter().sendMail({ from: env.EMAIL_FROM, ...mail });
}

const wrap = (title: string, body: string, ctaUrl: string, cta: string) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
  <h2 style="color:#0b1f4d">${title}</h2>
  <p style="line-height:1.6">${body}</p>
  <p><a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">${cta}</a></p>
  <p style="color:#64748b;font-size:12px">If the button does not work, copy this link: ${ctaUrl}</p>
</div>`;

export const sendVerificationEmail = (to: string, name: string, token: string) => {
  const url = `${env.CLIENT_URL}/verify-email?token=${token}`;
  return sendMail({
    to, subject: "Verify your CareerMatch AI email",
    text: `Hi ${name},\n\nVerify your email: ${url}\n\nThis link expires in 24 hours.`,
    html: wrap("Verify your email", `Hi ${name}, confirm your email address to finish setting up CareerMatch AI. The link expires in 24 hours.`, url, "Verify email"),
  });
};

export const sendPasswordResetEmail = (to: string, name: string, token: string) => {
  const url = `${env.CLIENT_URL}/reset-password?token=${token}`;
  return sendMail({
    to, subject: "Reset your CareerMatch AI password",
    text: `Hi ${name},\n\nReset your password: ${url}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
    html: wrap("Reset your password", `Hi ${name}, we received a request to reset your password. The link expires in 1 hour. If this wasn't you, ignore this email.`, url, "Reset password"),
  });
};
