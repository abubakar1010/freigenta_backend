import { Faq, IFaq } from "../models/faq.model";
import { AppError } from "../../../shared/utils/AppError";

export class FaqService {
  async getAllFaqs(): Promise<IFaq[]> {
    return Faq.find({}).sort({ order: 1 });
  }

  async createFaq(question: string, answer: string): Promise<IFaq> {
    if (!question || !answer) {
      throw new AppError("Question and answer are required.", 400);
    }

    // Auto-calculate the next order sequence number
    const maxFaq = await Faq.findOne({}).sort({ order: -1 });
    const nextOrder = maxFaq ? maxFaq.order + 1 : 1;

    const newFaq = new Faq({
      question,
      answer,
      order: nextOrder
    });

    return newFaq.save();
  }

  async updateFaq(id: string, question: string, answer: string): Promise<IFaq> {
    if (!question || !answer) {
      throw new AppError("Question and answer are required.", 400);
    }

    const faq = await Faq.findById(id);
    if (!faq) {
      throw new AppError("FAQ not found.", 404);
    }

    faq.question = question;
    faq.answer = answer;

    return faq.save();
  }

  async deleteFaq(id: string): Promise<void> {
    const faq = await Faq.findById(id);
    if (!faq) {
      throw new AppError("FAQ not found.", 404);
    }

    const removedOrder = faq.order;
    await Faq.deleteOne({ _id: id });

    // Shift all subsequent FAQ orders down by 1 to maintain a clean sequence
    await Faq.updateMany(
      { order: { $gt: removedOrder } },
      { $inc: { order: -1 } }
    );
  }

  async reorderFaqs(reorderList: { id: string; order: number }[]): Promise<void> {
    const bulkOps = reorderList.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: item.order } }
      }
    }));

    if (bulkOps.length > 0) {
      await Faq.bulkWrite(bulkOps);
    }
  }
}
