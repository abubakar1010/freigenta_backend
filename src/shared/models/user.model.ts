import { Schema, model, Document } from "mongoose";

export interface IBeneficialOwner {
  fullName: string;
  ownershipPercentage: number;
}

export interface IUser extends Document {
  // Step 1: Account Creation
  firstName: string;
  lastName: string;
  jobTitle: string;
  country: string;
  phoneNumber: string;
  emailAddress: string;
  passwordHash: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  identityDocumentUrl: string;
  proofOfAddressUrl: string;
  profilePictureUrl?: string;

  // Step 2: Company Information
  companyInfo?: {
    legalCompanyName: string;
    countryOfIncorporation: string;
    businessRegistrationNumber: string;
    tradingName?: string;
    taxIdentificationNumber?: string;
    tradingCountryofIncorporation: string;
    businessAddress: string;
    industryType: string;
    businessType: string;
    website?: string;
  };

  // Step 3: Company Documents & Owners
  companyDocuments?: {
    certificateOfIncorporationUrl: string;
    proofOfBusinessAddressUrl: string;
    beneficialOwnershipDocUrl: string;
    beneficialOwners: IBeneficialOwner[];
  };

  role: "CUSTOMER" | "ADMIN" | "OPS" | "COMPLIANCE" | "TREASURY";

  isActive: boolean;
  // Identity Verification
  bvn?: string;
  nin?: string;
  bvnMasked?: string;
  ninMasked?: string;
  identityVerificationStatus: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "MANUAL_REVIEW" | "REJECTED";
  identityVerificationResponse?: string;
  
  // Bridge Compliance
  bridgeCustomerId?: string;
  bridgeKycStatus: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED";
  bridgeEndorsementStatus?: string;

  onboardingStep:
    | "ACCOUNT_CREATION"
    | "COMPANY_INFO"
    | "COMPANY_DOCS"
    | "COMPLETED";
  notificationSettings?: {
    reg: boolean;
    kyc: boolean;
    doc: boolean;
    req: boolean;
    quote: boolean;
    accept: boolean;
    settle: boolean;
    renew: boolean;
  };
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const BeneficialOwnerSchema = new Schema<IBeneficialOwner>({
  fullName: { type: String, required: true },
  ownershipPercentage: { type: Number, required: true },
});

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    jobTitle: { type: String, required: function(this: any) { return this.role === "CUSTOMER"; } },
    country: { type: String, required: function(this: any) { return this.role === "CUSTOMER"; } },
    phoneNumber: { type: String, required: true },
    emailAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    identityDocumentUrl: { type: String, required: function(this: any) { return this.role === "CUSTOMER"; } },
    proofOfAddressUrl: { type: String, required: function(this: any) { return this.role === "CUSTOMER"; } },
    profilePictureUrl: { type: String },

    companyInfo: {
      legalCompanyName: { type: String },
      countryOfIncorporation: { type: String },
      businessRegistrationNumber: { type: String },
      tradingName: { type: String },
      taxIdentificationNumber: { type: String },
      businessAddress: { type: String },
      industryType: { type: String },
      businessType: { type: String },
      website: { type: String },
    },

    companyDocuments: {
      certificateOfIncorporationUrl: { type: String },
      proofOfBusinessAddressUrl: { type: String },
      beneficialOwnershipDocUrl: { type: String },
      beneficialOwners: [BeneficialOwnerSchema],
    },

    role: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", "OPS", "COMPLIANCE", "TREASURY"],
      default: "CUSTOMER",
    },

    isActive: { type: Boolean, default: true },

    bvn: { type: String },
    nin: { type: String },
    bvnMasked: { type: String },
    ninMasked: { type: String },
    identityVerificationStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "VERIFIED", "FAILED", "MANUAL_REVIEW", "REJECTED"],
      default: "NOT_STARTED",
    },
    identityVerificationResponse: { type: String },
    
    bridgeCustomerId: { type: String },
    bridgeKycStatus: {
      type: String,
      enum: ["NOT_STARTED", "PENDING", "APPROVED", "REJECTED"],
      default: "NOT_STARTED",
    },
    bridgeEndorsementStatus: { type: String },

    onboardingStep: {
      type: String,
      enum: ["ACCOUNT_CREATION", "COMPANY_INFO", "COMPANY_DOCS", "COMPLETED"],
      default: "ACCOUNT_CREATION",
    },
    notificationSettings: {
      reg: { type: Boolean, default: true },
      kyc: { type: Boolean, default: true },
      doc: { type: Boolean, default: true },
      req: { type: Boolean, default: true },
      quote: { type: Boolean, default: true },
      accept: { type: Boolean, default: true },
      settle: { type: Boolean, default: true },
      renew: { type: Boolean, default: true }
    },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", UserSchema);


