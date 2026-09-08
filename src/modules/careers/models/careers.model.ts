import { Schema, model, Document } from "mongoose";

export interface ICareer extends Document {
  title: string;
  description: string;
  location: string;
  workType: string;
  status: "Visible" | "Hidden";
  formLink: string;
  createdAt: Date;
  updatedAt: Date;
}

const CareerSchema = new Schema<ICareer>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    workType: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Visible", "Hidden"],
      default: "Hidden",
      required: true
    },
    formLink: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

export const Career = model<ICareer>("Career", CareerSchema);
