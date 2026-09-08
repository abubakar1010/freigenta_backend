import crypto from 'crypto';
import { AppError } from '../../shared/utils/AppError';
import { requireEnv } from '../../shared/utils/env';

export class FindTEUWebhooks {
  /**
   * FINDTEU_WEBHOOK_SECRET is required. Verification fails closed: an unset
   * secret used to skip signature checking altogether, which accepted forged
   * shipment events from anyone who knew the endpoint.
   *
   * Read lazily so a missing secret fails the individual request as a
   * misconfiguration, instead of crashing the process at import time.
   */
  private get webhookSecret(): string {
    return requireEnv('FINDTEU_WEBHOOK_SECRET');
  }

  public verifySignature(rawBody: any, signature: string): void {
    if (!signature) {
      throw new AppError('Missing FindTEU webhook signature', 401);
    }

    const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payloadString)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new AppError('Invalid FindTEU webhook signature', 401);
    }
  }
}

export const findteuWebhooks = new FindTEUWebhooks();
