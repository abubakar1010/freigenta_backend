import crypto from "crypto";
import bcrypt from "bcrypt";
import { Otp } from "../models/otp.model";
import { AppError } from "../utils/AppError";
import { MailService } from "./mail.service";
import { SmsService } from "./sms.service";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;

// Cryptographically secure OTP generation (not Math.random)
function generateSecureOtp(): string {
  const digits = "0123456789";
  const randomBytes = crypto.randomBytes(OTP_LENGTH);
  return Array.from(randomBytes)
    .map((byte) => digits[byte % 10])
    .join("");
}

export class OtpService {
  private mailService = new MailService();
  private smsService = new SmsService();

  async sendOtp(identifier: string, type: "EMAIL" | "PHONE"): Promise<void> {
    const key = identifier.toLowerCase();

    // Rate limiting: prevent spamming
    const recentOtp = await Otp.findOne({ identifier: key, type }).sort({
      createdAt: -1,
    });
    if (recentOtp) {
      const secondsSinceCreation =
        (Date.now() - recentOtp.createdAt.getTime()) / 1000;
      if (secondsSinceCreation < RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = Math.ceil(
          RESEND_COOLDOWN_SECONDS - secondsSinceCreation,
        );
        throw new AppError(
          `Please wait ${waitSeconds} seconds before requesting a new code.`,
          429,
        );
      }
    }

    const plainCode = generateSecureOtp();
    const hashedCode = await bcrypt.hash(plainCode, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await Otp.create({ identifier: key, type, code: hashedCode, expiresAt });

    if (type === "EMAIL") {
      await this.mailService.sendVerificationEmail(identifier, plainCode);
    } else {
      await this.smsService.sendVerificationSms(identifier, plainCode);
    }
  }

  async verifyOtp(
    identifier: string,
    type: "EMAIL" | "PHONE",
    plainCode: string,
  ): Promise<void> {
    const key = identifier.toLowerCase();

    // Get the most recent un-verified OTP for this identifier
    const record = await Otp.findOne({
      identifier: key,
      type,
      isVerified: false,
    }).sort({ createdAt: -1 });

    if (!record) {
      throw new AppError(
        "No active verification code found. Please request a new one.",
        400,
      );
    }

    if (record.expiresAt < new Date()) {
      throw new AppError(
        "Verification code has expired. Please request a new one.",
        400,
      );
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      throw new AppError(
        "Too many incorrect attempts. Please request a new code.",
        400,
      );
    }

    const isMocked = type === "EMAIL" ? !this.mailService.isConfigured() : !this.smsService.isConfigured();
    const isDeveloperBypass = isMocked && plainCode === "123456";

    const isMatch = isDeveloperBypass || (await bcrypt.compare(plainCode, record.code));

    if (!isMatch) {
      // Increment attempt count
      record.attempts += 1;
      await record.save();

      const remaining = MAX_ATTEMPTS - record.attempts;
      if (remaining <= 0) {
        throw new AppError(
          "Too many incorrect attempts. Please request a new code.",
          400,
        );
      }
      throw new AppError(
        `Invalid code. ${remaining} attempt(s) remaining.`,
        400,
      );
    }

    // Mark OTP as verified and consumed
    record.isVerified = true;
    record.attempts = MAX_ATTEMPTS;
    await record.save();
  }

  async hasVerified(
    identifier: string,
    type: "EMAIL" | "PHONE",
  ): Promise<boolean> {
    const key = identifier.toLowerCase();
    const record = await Otp.findOne({
      identifier: key,
      type,
      isVerified: true,
    }).sort({ updatedAt: -1 });

    if (!record) return false;

    // Must have been verified within the last 15 minutes
    const fifteenMinutes = 15 * 60 * 1000;
    const isFresh = Date.now() - record.updatedAt.getTime() < fifteenMinutes;
    return isFresh;
  }
}
