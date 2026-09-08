import { Request, Response, NextFunction } from "express";
import { SettingsService } from "../service/settings.service";

const settingsService = new SettingsService();

export class SettingsController {
  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await settingsService.getSettings();
      res.status(200).json({ success: true, settings });
    } catch (error) {
    next(error);
  }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        coverImageUrl,
        privacyPolicy,
        termsAndConditions,
        aboutHeroTitle,
        aboutHeroSubtitle,
        aboutHeroImageUrl,
        aboutWhoWeAreText,
        aboutYearsFounding,
        aboutYearsLabel,
        aboutYearsSublabel,
        aboutTotalSales,
        aboutSalesLabel,
        aboutSalesSublabel
      } = req.body;
      const settings = await settingsService.updateSettings({
        coverImageUrl,
        privacyPolicy,
        termsAndConditions,
        aboutHeroTitle,
        aboutHeroSubtitle,
        aboutHeroImageUrl,
        aboutWhoWeAreText,
        aboutYearsFounding,
        aboutYearsLabel,
        aboutYearsSublabel,
        aboutTotalSales,
        aboutSalesLabel,
        aboutSalesSublabel
      });
      res.status(200).json({ success: true, message: "Settings updated successfully.", settings });
    } catch (error) {
    next(error);
  }
  };
}
