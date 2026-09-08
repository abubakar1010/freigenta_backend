import axios from "axios";
import { AppError } from "../utils/AppError";
import { decrypt } from "../utils/crypto";
import { requireEnv } from "../utils/env";

export type YouVerifyStatus =
  | "VERIFIED"
  | "FAILED"
  | "PENDING"
  | "MANUAL_REVIEW"
  | "REJECTED";

export class YouVerifyService {
  private isSandbox = process.env.USE_SANDBOX === "true";
  private baseUrl =
    process.env.YOUVERIFY_API_URL || "https://api.youverify.co/v2";

  // Getter, not a field: verifyIdentity short-circuits to mocks in sandbox, so
  // the key is only required when a real YouVerify call is about to be made.
  private get apiKey(): string {
    return requireEnv("YOUVERIFY_API_KEY");
  }

  async verifyIdentity(
    type: "BVN" | "NIN",
    encryptedValue: string,
  ): Promise<{ status: YouVerifyStatus; rawResponse: any }> {
    const rawIdentifier = decrypt(encryptedValue);

    if (this.isSandbox) {
      if (rawIdentifier.startsWith("9")) {
        return {
          status: "FAILED",
          rawResponse: { mock: true, reason: "Test failure" },
        };
      }
      if (rawIdentifier.startsWith("8")) {
        return {
          status: "MANUAL_REVIEW",
          rawResponse: { mock: true, reason: "Test review" },
        };
      }
      return {
        status: "VERIFIED",
        rawResponse: { mock: true, reason: "Test success" },
      };
    }

    try {
      const endpoint = type === "BVN" ? "/identity/ng/bvn" : "/identity/ng/nin";
      const payload =
        type === "BVN"
          ? { id: rawIdentifier, isSubjectConsent: true }
          : { id: rawIdentifier, isSubjectConsent: true };

      const response = await axios.post(`${this.baseUrl}${endpoint}`, payload, {
        headers: {
          token: this.apiKey,
          "Content-Type": "application/json",
        },
      });

      const yvStatus = response.data?.data?.status;

      let mappedStatus: YouVerifyStatus = "PENDING";
      if (yvStatus === "found") mappedStatus = "VERIFIED";
      else if (yvStatus === "not_found") mappedStatus = "FAILED";
      else mappedStatus = "MANUAL_REVIEW";

      return {
        status: mappedStatus,
        rawResponse: response.data,
      };
    } catch (error: any) {
      console.error(
        "[YouVerifyService] Failed identity verification:",
        error.message,
      );
      throw new AppError("Failed identity verification via YouVerify API", 502);
    }
  }

  /**
   * Verifies an inbound YouVerify webhook.
   *
   * YOUVERIFY_WEBHOOK_SECRET is required and has no fallback. These webhooks
   * drive KYC outcomes, so a guessable or absent secret would let anyone mark
   * an account as verified.
   */
  public verifySignature(rawBody: any, signature: string): void {
    const webhookSecret = requireEnv("YOUVERIFY_WEBHOOK_SECRET");
    if (!signature) {
      throw new AppError('Missing YouVerify webhook signature', 401);
    }

    const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new AppError('Invalid YouVerify webhook signature', 401);
    }
  }
}

export const youverifyService = new YouVerifyService();
