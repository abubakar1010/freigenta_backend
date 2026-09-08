import { z } from "zod";

export const step1Schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jobTitle: z.string().min(1),
  country: z.string().min(1),
  phoneNumber: z.string().min(1),
  emailAddress: z.string().email(),
  password: z.string().min(8),
  identityDocumentUrl: z.string().url(),
  proofOfAddressUrl: z.string().url(),
  profilePictureUrl: z.string().url().optional(),
});

export const step2Schema = z.object({
  legalCompanyName: z.string().min(1),
  countryOfIncorporation: z.string().min(1),
  businessRegistrationNumber: z.string().min(1),
  tradingName: z.string().optional(),
  taxIdentificationNumber: z.string().optional(),
  businessAddress: z.string().min(1),
  industryType: z.string().min(1),
  businessType: z.string().min(1),
  website: z.string().url().optional(),
});

export const step3Schema = z.object({
  certificateOfIncorporationUrl: z.string().url(),
  proofOfBusinessAddressUrl: z.string().url(),
  beneficialOwnershipDocUrl: z.string().url(),
  beneficialOwners: z
    .array(
      z.object({
        fullName: z.string().min(1),
        ownershipPercentage: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z.string().min(8),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1),
  jobTitle: z.string().min(1),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
