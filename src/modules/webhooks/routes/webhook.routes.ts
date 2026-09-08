import { Router, Request, Response } from "express";
import { escaWebhooks } from "../../../integrations/esca/esca.webhooks";
import { bridgeWebhooks } from "../../../integrations/bridge/bridge.webhooks";
import { findteuWebhooks } from "../../../integrations/findteu/findteu.webhooks";
import { youverifyService } from "../../../shared/services/youverify.service";
import { queueService } from "../../../shared/services/queue.service";
import { logger } from "../../../shared/utils/logger";

const router = Router();

/**
 * Extracts the raw body Buffer from the request.
 * The body was captured in server.ts via express.json({ verify }) and stored
 * at req.rawBody. We reject the request if it is absent — this means the
 * signature would be computed against a parsed JS object (wrong) rather than
 * the actual wire bytes.
 */
function extractRawBody(req: Request): Buffer {
  const raw = (req as any).rawBody;
  if (!raw || !Buffer.isBuffer(raw)) {
    throw new Error("rawBody not available — cannot verify webhook signature");
  }
  return raw;
}

/** Sends an immediate HTTP 200 so the provider does not retry. */
function ack(res: Response): void {
  res.status(200).send("Webhook received");
}

// ── POST /api/webhooks/esca ──────────────────────────────────────────────────
router.post("/esca", async (req: Request, res: Response) => {
  try {
    const signature =
      (req.headers["x-webhook-signature"] as string) ||
      (req.headers["esca-signature"] as string);

    const rawBody = extractRawBody(req);
    escaWebhooks.verifySignature(rawBody.toString("utf8"), signature);

    const eventId: string = req.body.id || req.body.event_id;
    if (!eventId) {
      res.status(400).send("Missing event ID");
      return;
    }

    await queueService.addJob(
      "process-esca-webhook",
      "esca_webhook",
      req.body,
      `esca_webhook_${eventId}`
    );

    ack(res);
  } catch (error: any) {
    logger.warn(
      { err: error.message, path: "/api/webhooks/esca" },
      "[Webhook] Esca signature verification failed"
    );
    res.status(401).send("Unauthorized");
  }
});

// ── POST /api/webhooks/bridge ────────────────────────────────────────────────
router.post("/bridge", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-webhook-signature"] as string;

    const rawBody = extractRawBody(req);
    bridgeWebhooks.verifySignature(rawBody.toString("utf8"), signature);

    const eventId: string = req.body.id;
    if (!eventId) {
      res.status(400).send("Missing event ID");
      return;
    }

    await queueService.addJob(
      "process-bridge-webhook",
      "bridge_webhook",
      req.body,
      `bridge_webhook_${eventId}`
    );

    ack(res);
  } catch (error: any) {
    logger.warn(
      { err: error.message, path: "/api/webhooks/bridge" },
      "[Webhook] Bridge signature verification failed"
    );
    res.status(401).send("Unauthorized");
  }
});

// ── POST /api/webhooks/youverify ─────────────────────────────────────────────
router.post("/youverify", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-youverify-signature"] as string;

    const rawBody = extractRawBody(req);
    youverifyService.verifySignature(rawBody, signature);

    const eventId: string = req.body.id || req.body.eventId;
    if (!eventId) {
      res.status(400).send("Missing event ID");
      return;
    }

    await queueService.addJob(
      "process-youverify-webhook",
      "youverify_webhook",
      req.body,
      `yv_webhook_${eventId}`
    );

    ack(res);
  } catch (error: any) {
    logger.warn(
      { err: error.message, path: "/api/webhooks/youverify" },
      "[Webhook] YouVerify signature verification failed"
    );
    res.status(401).send("Unauthorized");
  }
});

// ── POST /api/webhooks/findteu ───────────────────────────────────────────────
router.post("/findteu", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-findteu-signature"] as string;

    const rawBody = extractRawBody(req);
    findteuWebhooks.verifySignature(rawBody.toString("utf8"), signature);

    const eventId: string = req.body.eventId || req.body.id;
    if (!eventId) {
      res.status(400).send("Missing event ID");
      return;
    }

    await queueService.addJob(
      "process-findteu-webhook",
      "findteu_webhook",
      req.body,
      `findteu_webhook_${eventId}`
    );

    ack(res);
  } catch (error: any) {
    logger.warn(
      { err: error.message, path: "/api/webhooks/findteu" },
      "[Webhook] FindTEU signature verification failed"
    );
    res.status(401).send("Unauthorized");
  }
});

export const webhookRoutes = router;
