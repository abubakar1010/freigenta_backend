import dotenv from "dotenv";
dotenv.config();

// Logger must be imported AFTER dotenv.config() so LOG_LEVEL is available
import { logger } from "./shared/utils/logger";
import app from "./server";
import http from "http";
import { connectDB } from "./shared/database/mongo";
import { SocketService } from "./shared/services/socket.service";
import { registerAllWorkers } from "./workers";
import { queueService } from "./shared/services/queue.service";

const PORT = parseInt(process.env.PORT || "8080", 10);
const server = http.createServer(app);

// Initialize real-time Socket.io server
SocketService.getInstance().init(server);

/**
 * Graceful shutdown handler.
 *
 * On SIGTERM (Kubernetes pod eviction, Docker stop) or SIGINT (Ctrl+C):
 * 1. Stop accepting new connections
 * 2. Drain BullMQ workers
 * 3. Close the HTTP server after in-flight requests complete
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received — draining workers");
  try {
    await queueService.shutdown();
    server.close(() => {
      logger.info("HTTP server closed — process exiting cleanly");
      process.exit(0);
    });

    // Force exit after 30 seconds if graceful drain stalls
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 30_000).unref();
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — process exiting");
  process.exit(1);
});

const start = async (): Promise<void> => {
  await connectDB();
  registerAllWorkers();
  server.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, "Server started");
  });
};

start();
