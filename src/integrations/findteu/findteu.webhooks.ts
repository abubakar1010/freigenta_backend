import crypto from 'crypto';
import { AppError } from '../../shared/utils/AppError';

export class FindTEUWebhooks {
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.FINDTEU_WEBHOOK_SECRET || '';
  }

  public verifySignature(rawBody: any, signature: string): void {
    if (!this.webhookSecret) {
      console.warn('[FindTEUWebhooks] No webhook secret configured. Bypassing signature verification.');
      return;
    }

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
