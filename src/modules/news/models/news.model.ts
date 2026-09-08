import { Schema, model, Document } from "mongoose";

export interface INews extends Document {
  title: string;
  content: string;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    imageUrl: {
      type: String,
      default: "https://images.unsplash.com/photo-1586528116311-ad8ed7c66324?auto=format&fit=crop&w=800&q=80",
      trim: true
    }
  },
  { timestamps: true }
);

export const News = model<INews>("News", NewsSchema);
