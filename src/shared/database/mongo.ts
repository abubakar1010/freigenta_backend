import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  const MONGO_URI = process.env.DATABASE_URL;
  if (!MONGO_URI) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};
