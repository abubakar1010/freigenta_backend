import { Schema, model, Document } from "mongoose";

export interface IFaq extends Document {
  order: number;
  question: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema = new Schema<IFaq>(
  {
    order: { type: Number, required: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const Faq = model<IFaq>("Faq", FaqSchema);
