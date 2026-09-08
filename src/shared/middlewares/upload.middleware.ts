import fileUpload from "express-fileupload";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

// Configured fileUpload middleware
export const upload = fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: false, // We handle limits manually to throw AppError
});

export const validateUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.files || !req.files.file) {
    return next(new AppError("No file uploaded.", 400));
  }

  const file = req.files.file as fileUpload.UploadedFile;

  // Enforce size limit
  if (file.truncated) {
    return next(new AppError("File size limit exceeded. Max limit is 10MB.", 400));
  }

  // Validate mime type
  const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return next(new AppError("Invalid file type. Only JPEG, PNG, and PDF are allowed.", 400));
  }

  next();
};
