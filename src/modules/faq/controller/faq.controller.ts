import { Request, Response, NextFunction } from "express";
import { FaqService } from "../service/faq.service";

const faqService = new FaqService();

export class FaqController {
  getAllFaqs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const faqs = await faqService.getAllFaqs();
      res.status(200).json({
        success: true,
        data: faqs.map(f => ({
          id: f._id.toString(),
          order: f.order,
          question: f.question,
          answer: f.answer
        }))
      });
    } catch (error) {
    next(error);
  }
  };

  createFaq = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { question, answer } = req.body;
      const faq = await faqService.createFaq(question, answer);
      res.status(201).json({
        success: true,
        data: {
          id: faq._id.toString(),
          order: faq.order,
          question: faq.question,
          answer: faq.answer
        }
      });
    } catch (error) {
    next(error);
  }
  };

  updateFaq = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { question, answer } = req.body;
      const faq = await faqService.updateFaq(id, question, answer);
      res.status(200).json({
        success: true,
        data: {
          id: faq._id.toString(),
          order: faq.order,
          question: faq.question,
          answer: faq.answer
        }
      });
    } catch (error) {
    next(error);
  }
  };

  deleteFaq = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      await faqService.deleteFaq(id);
      res.status(200).json({
        success: true,
        message: "FAQ successfully deleted."
      });
    } catch (error) {
    next(error);
  }
  };

  reorderFaqs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { reorderList } = req.body; // Array of { id: string, order: number }
      await faqService.reorderFaqs(reorderList);
      res.status(200).json({
        success: true,
        message: "FAQs successfully reordered."
      });
    } catch (error) {
    next(error);
  }
  };
}
