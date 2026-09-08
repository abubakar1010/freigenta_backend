import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { ZodError } from "zod";

/**
 * Global Express error handler.
 *
 * Rules:
 * 1. Operational errors (AppError) are surfaced to the client with their
 *    designated status code and message.
 * 2. Programming errors (unexpected) return a generic 500. Stack traces
 *    are logged server-side but never sent to clients in production — they
 *    reveal internal implementation details and aid attackers.
 * 3. Mongoose duplicate-key errors (code 11000) are normalised to 409.
 * 4. All errors are structured-logged so they are searchable in Datadog/Splunk.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === "production";

  if (err instanceof AppError) {
    // Operational error — expected, log at warn level
    logger.warn(
      {
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        err: err.message,
      },
      "[ErrorHandler] Operational error"
    );
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn({ err: err.issues, path: req.path }, "[ErrorHandler] Zod validation error");
    const message = err.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ");
    res.status(400).json({
      success: false,
      message,
      errors: err.issues,
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue ?? {})[0] ?? "field";
    logger.warn({ err: err.message, path: req.path }, "[ErrorHandler] Duplicate key");
    res.status(409).json({
      success: false,
      message: `A record with that ${field} already exists.`,
    });
    return;
  }

  // Mongoose validation error
  if ((err as any).name === "ValidationError") {
    logger.warn({ err: err.message }, "[ErrorHandler] Mongoose validation error");
    res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: (err as any).errors,
    });
    return;
  }

  // Unhandled programming error — log full stack, never send to client
  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      body: req.body,
    },
    "[ErrorHandler] Unhandled server error"
  );

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    ...(isProduction ? {} : { stack: err.stack }),
  });
};


