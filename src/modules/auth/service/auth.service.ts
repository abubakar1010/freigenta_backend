import { IUser, User } from "../../../shared/models/user.model";
import { OtpService } from "../../../shared/services/otp.service";
import { AppError } from "../../../shared/utils/AppError";
import { generateToken } from "../../../shared/utils/jwt.util";
import { MailService } from "../../../shared/services/mail.service";
import bcrypt from "bcrypt";
import crypto from "crypto";

const otpService = new OtpService();

export class AuthService {
  //  SIGN IN
  async signIn(data: { email: string; password: string }) {
    const user = await User.findOne({ emailAddress: data.email.toLowerCase() });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.isActive === false) throw new AppError("Your account has been deactivated. Please contact support.", 403);

    // if (!user.isPhoneVerified)
    //   throw new AppError(
    //     "Please verify your phone number before signing in.",
    //     403,
    //   );

    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );
    if (!isPasswordValid) throw new AppError("Invalid email or password", 401);

    const accessToken = generateToken({
      userId: user._id.toString(),
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        emailAddress: user.emailAddress,
        onboardingStep: user.onboardingStep,
        role: user.role,
      },
    };
  }

  //  STEP 1: CREATE ACCOUNT
  async createAccount(data: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    country: string;
    phoneNumber: string;
    emailAddress: string;
    password: string;
    identityDocumentUrl: string;
    proofOfAddressUrl: string;
    profilePictureUrl?: string;
  }): Promise<{ user: IUser; accessToken: string }> {
    // Guard: phone must be verified before account creation
    const phoneVerified = await otpService.hasVerified(
      data.phoneNumber,
      "PHONE",
    );
    if (!phoneVerified)
      throw new AppError(
        "Phone number must be verified before creating an account.",
        400,
      );

    const existingUser = await User.findOne({
      emailAddress: data.emailAddress.toLowerCase(),
    });
    if (existingUser)
      throw new AppError("An account with this email already exists.", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await User.create({
      ...data,
      emailAddress: data.emailAddress.toLowerCase(),
      passwordHash,
      isEmailVerified: true,
      isPhoneVerified: true,
      onboardingStep: "COMPANY_INFO",
    });

    const accessToken = generateToken({
      userId: newUser._id.toString(),
      role: newUser.role,
    });

    return { user: newUser, accessToken };
  }

  async sendPhoneOtp(phone: string): Promise<void> {
    await otpService.sendOtp(phone, "PHONE");
  }

  // OTP: VERIFY
  async verifyPhoneOtp(phone: string, code: string): Promise<void> {
    await otpService.verifyOtp(phone, "PHONE", code);
  }

  // STEP 2: COMPANY INFO
  async saveCompanyInfo(userId: string, companyData: any) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { companyInfo: companyData, onboardingStep: "COMPANY_DOCS" } },
      { new: true },
    );
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  // STEP 3: COMPANY DOCS
  async saveCompanyDocs(userId: string, docsData: any) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { companyDocuments: docsData, onboardingStep: "COMPLETED" } },
      { new: true },
    );
    if (!user) throw new AppError("User not found", 404);
    return user;
  }

  // PASSWORD RESET REQUEST
  async requestPasswordReset(email: string): Promise<void> {
    const user = await User.findOne({ emailAddress: email.toLowerCase() });
    if (!user) {
      // Security best practice: do not reveal whether the user exists or not
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = token;
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour validity
    await user.save();

    const mailService = new MailService();
    await mailService.sendPasswordResetEmail(user.emailAddress, token);
  }

  // PASSWORD RESET EXECUTE
  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const user = await User.findOne({
      emailAddress: email.toLowerCase(),
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new AppError("Invalid or expired password reset token.", 400);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
  }

  // UPDATE PROFILE (ENTERPRISE SAAS)
  async updateProfile(
    userId: string,
    data: { firstName: string; lastName: string; phoneNumber: string; jobTitle: string }
  ) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
    if (data.jobTitle) user.jobTitle = data.jobTitle;

    await user.save();
    return user;
  }

  // UPDATE PASSWORD
  async updatePassword(
    userId: string,
    data: { currentPassword: string; newPassword: string }
  ) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!isMatch) throw new AppError("Current password is incorrect.", 400);

    user.passwordHash = await bcrypt.hash(data.newPassword, 10);
    await user.save();
  }

  // GET NOTIFICATIONS PREFERENCES
  async getNotificationSettings(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    // Return current settings or seed default
    return user.notificationSettings || {
      reg: true,
      kyc: true,
      doc: true,
      req: true,
      quote: true,
      accept: true,
      settle: true,
      renew: true
    };
  }

  // UPDATE NOTIFICATIONS PREFERENCES
  async updateNotificationSettings(userId: string, settings: any) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    user.notificationSettings = {
      reg: settings.reg ?? true,
      kyc: settings.kyc ?? true,
      doc: settings.doc ?? true,
      req: settings.req ?? true,
      quote: settings.quote ?? true,
      accept: settings.accept ?? true,
      settle: settings.settle ?? true,
      renew: settings.renew ?? true
    };

    await user.save();
    return user.notificationSettings;
  }
}

