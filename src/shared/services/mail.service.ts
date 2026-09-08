import nodemailer from "nodemailer";

export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: {
          user,
          pass,
        },
      });
    } else {
      console.warn(
        "[MailService] SMTP credentials missing. Falling back to console logging.",
      );
    }
  }

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    const from =
      process.env.SMTP_FROM || '"Freigenta" <no-reply@freigenta.com>';
    const subject = "Verify your email address - Freigenta";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 8px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Welcome to Freigenta</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
          Please use the following 6-digit verification code to complete your email verification process:
        </p>
        <div style="background-color: #f3f4f6; padding: 12px 24px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; color: #111827; border-radius: 6px;">
          ${code}
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          This code will expire in 10 minutes. If you did not request this, please ignore this email.
        </p>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        });
      } catch (smtpError) {
        console.error("[MailService SMTP Error] Failed to send verification email:", smtpError);
        console.log(
          `[MailService FALLBACK] Verification email to ${to}. Code: ${code}`
        );
      }
    } else {
      console.log(
        `[MailService MOCK] Sending verification email to ${to}. Code: ${code}`,
      );
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const from =
      process.env.SMTP_FROM || '"Freigenta" <no-reply@freigenta.com>';
    const subject = "Reset your password - Freigenta";
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Password Reset Request</h2>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
          You requested to reset your password. Please click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetLink}" style="background-color: #182232; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #4b5563; font-size: 13px; line-height: 1.5;">
          If the button doesn't work, copy and paste this link in your browser:
        </p>
        <p style="color: #3b82f6; font-size: 13px; word-break: break-all;">
          ${resetLink}
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          This link will expire in 1 hour. If you did not request this, please ignore this email.
        </p>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        });
      } catch (smtpError) {
        console.error("[MailService SMTP Error] Failed to send password reset email:", smtpError);
        console.log(
          `[MailService FALLBACK] Password reset email link to ${to}. Link: ${resetLink}`
        );
      }
    } else {
      console.log(
        `[MailService MOCK] Sending password reset email to ${to}. Link: ${resetLink}`,
      );
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}

