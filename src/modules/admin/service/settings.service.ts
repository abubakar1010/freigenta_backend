import { Settings, ISettings } from "../../../shared/models/settings.model";

export class SettingsService {
  async getSettings(): Promise<ISettings> {
    let settings = await Settings.findOne();
    if (!settings) {
      // Seed default settings if none exist
      settings = await Settings.create({
        coverImageUrl: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=1200&h=400&q=80",
        privacyPolicy: "Effective Date: June 22, 2026\n\nThis is the default privacy policy.",
        termsAndConditions: "Effective Date: June 22, 2026\n\nThis is the default terms and conditions.",
        aboutHeroTitle: "",
        aboutHeroSubtitle: "",
        aboutHeroImageUrl: "",
        aboutWhoWeAreText: "",
        aboutYearsFounding: "",
        aboutYearsLabel: "",
        aboutYearsSublabel: "",
        aboutTotalSales: "",
        aboutSalesLabel: "",
        aboutSalesSublabel: "",
      });
    }
    return settings;
  }

  async updateSettings(data: {
    coverImageUrl?: string;
    privacyPolicy?: string;
    termsAndConditions?: string;
    aboutHeroTitle?: string;
    aboutHeroSubtitle?: string;
    aboutHeroImageUrl?: string;
    aboutWhoWeAreText?: string;
    aboutYearsFounding?: string;
    aboutYearsLabel?: string;
    aboutYearsSublabel?: string;
    aboutTotalSales?: string;
    aboutSalesLabel?: string;
    aboutSalesSublabel?: string;
  }): Promise<ISettings> {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({
        coverImageUrl: data.coverImageUrl || "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&w=1200&h=400&q=80",
        privacyPolicy: data.privacyPolicy || "Effective Date: June 22, 2026\n\nThis is the default privacy policy.",
        termsAndConditions: data.termsAndConditions || "Effective Date: June 22, 2026\n\nThis is the default terms and conditions.",
        aboutHeroTitle: data.aboutHeroTitle || "About Cicero",
        aboutHeroSubtitle: data.aboutHeroSubtitle || "Follow a simple step-by-step process to submit your request, upload documents, and track approval status.",
        aboutHeroImageUrl: data.aboutHeroImageUrl || "",
        aboutWhoWeAreText: data.aboutWhoWeAreText || "We provide a digital freight payment management platform...",
        aboutYearsFounding: data.aboutYearsFounding || "12",
        aboutYearsLabel: data.aboutYearsLabel || "",
        aboutYearsSublabel: data.aboutYearsSublabel || "Founded in 2014",
        aboutTotalSales: data.aboutTotalSales || "$123M",
        aboutSalesLabel: data.aboutSalesLabel || "",
        aboutSalesSublabel: data.aboutSalesSublabel || "As of 2026",
      });
      await settings.save();
      return settings;
    }

    if (data.coverImageUrl !== undefined) settings.coverImageUrl = data.coverImageUrl;
    if (data.privacyPolicy !== undefined) settings.privacyPolicy = data.privacyPolicy;
    if (data.termsAndConditions !== undefined) settings.termsAndConditions = data.termsAndConditions;
    if (data.aboutHeroTitle !== undefined) settings.aboutHeroTitle = data.aboutHeroTitle;
    if (data.aboutHeroSubtitle !== undefined) settings.aboutHeroSubtitle = data.aboutHeroSubtitle;
    if (data.aboutHeroImageUrl !== undefined) settings.aboutHeroImageUrl = data.aboutHeroImageUrl;
    if (data.aboutWhoWeAreText !== undefined) settings.aboutWhoWeAreText = data.aboutWhoWeAreText;
    if (data.aboutYearsFounding !== undefined) settings.aboutYearsFounding = data.aboutYearsFounding;
    if (data.aboutYearsLabel !== undefined) settings.aboutYearsLabel = data.aboutYearsLabel;
    if (data.aboutYearsSublabel !== undefined) settings.aboutYearsSublabel = data.aboutYearsSublabel;
    if (data.aboutTotalSales !== undefined) settings.aboutTotalSales = data.aboutTotalSales;
    if (data.aboutSalesLabel !== undefined) settings.aboutSalesLabel = data.aboutSalesLabel;
    if (data.aboutSalesSublabel !== undefined) settings.aboutSalesSublabel = data.aboutSalesSublabel;

    await settings.save();
    return settings;
  }
}
