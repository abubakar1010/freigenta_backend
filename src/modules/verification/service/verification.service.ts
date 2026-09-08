import { User } from "../../../shared/models/user.model";
import { logAudit } from "../../../shared/utils/audit";
import { AppError } from "../../../shared/utils/AppError";
import { encrypt } from "../../../shared/utils/crypto";
import { YouVerifyService } from "../../../shared/services/youverify.service";

export class VerificationService {
  async submitVerification(userId: string, type: "BVN" | "NIN", number: string, ip?: string) {
    if (!type || !["BVN", "NIN"].includes(type)) {
      throw new AppError("Invalid verification type. Must be BVN or NIN.", 400);
    }

    if (!number || !/^\d{11}$/.test(number)) {
      throw new AppError("Identifier number must be exactly 11 digits.", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // Masking the identifier for security storage (Section 4.4 requirements)
    const maskedNumber = `******${number.slice(-5)}`;

    const encryptedNumber = encrypt(number);
    const youverifyService = new YouVerifyService();
    const verificationResult = await youverifyService.verifyIdentity(type, encryptedNumber);

    const status = verificationResult.status;
    const previousStatus = user.identityVerificationStatus;

    if (type === "BVN") {
      user.bvn = encryptedNumber;
      user.bvnMasked = maskedNumber;
      user.nin = undefined;
      user.ninMasked = undefined;
    } else {
      user.nin = encryptedNumber;
      user.ninMasked = maskedNumber;
      user.bvn = undefined;
      user.bvnMasked = undefined;
    }

    user.identityVerificationStatus = status;
    user.identityVerificationResponse = JSON.stringify({
      provider: "YouVerify",
      timestamp: new Date().toISOString(),
      rawResponse: verificationResult.rawResponse,
    });

    await user.save();

    // Log the audit event (Section 23 requirements)
    await logAudit(
      userId,
      "IDENTITY_VERIFICATION_SUBMITTED",
      user._id.toString(),
      { identityVerificationStatus: previousStatus },
      { identityVerificationStatus: status, type, number: maskedNumber },
      ip
    );

    return {
      identityVerificationStatus: status,
    };
  }

  async getVerificationStatus(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return {
      identityVerificationStatus: user.identityVerificationStatus,
    };
  }
}
