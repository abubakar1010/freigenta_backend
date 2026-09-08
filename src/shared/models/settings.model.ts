import { Schema, model, Document } from "mongoose";

export interface ISettings extends Document {
  coverImageUrl: string;
  privacyPolicy: string;
  termsAndConditions: string;
  aboutHeroTitle: string;
  aboutHeroSubtitle: string;
  aboutHeroImageUrl: string;
  aboutWhoWeAreText: string;
  aboutYearsFounding: string;
  aboutYearsLabel: string;
  aboutYearsSublabel: string;
  aboutTotalSales: string;
  aboutSalesLabel: string;
  aboutSalesSublabel: string;
}

const SettingsSchema = new Schema<ISettings>(
  {
    coverImageUrl: { type: String, required: true },
    privacyPolicy: { type: String, required: true },
    termsAndConditions: { type: String, required: true, default: "" },
    aboutHeroTitle: { type: String, default: "About Cicero" },
    aboutHeroSubtitle: { type: String, default: "Follow a simple step-by-step process to submit your request, upload documents, and track approval status." },
    aboutHeroImageUrl: { type: String, default: "" },
    aboutWhoWeAreText: { type: String, default: "We provide a digital freight payment management platform that helps customers submit payment or shipment-related requests, upload required documents, complete KYC verification, and track request status from one secure dashboard. Our platform connects customers with operations and compliance teams, making the review, approval, and document correction process faster, clearer, and more organized." },
    aboutYearsFounding: { type: String, default: "12" },
    aboutYearsLabel: { type: String, default: "" },
    aboutYearsSublabel: { type: String, default: "Founded in 2014" },
    aboutTotalSales: { type: String, default: "$123M" },
    aboutSalesLabel: { type: String, default: "" },
    aboutSalesSublabel: { type: String, default: "As of 2026" },
  },
  { timestamps: true }
);

export const Settings = model<ISettings>("Settings", SettingsSchema);
