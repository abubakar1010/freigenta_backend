import crypto from 'crypto';
import { AppError } from '../../shared/utils/AppError';

export class EscaWebhooks {
  private secret: string;

  constructor() {
    this.secret = process.env.ESCA_WEBHOOK_SECRET || '';
  }

  /**
   * Verifies the Esca webhook signature.
   * Based on Esca's documented signature algorithm (typically HMAC SHA-256).
   */
  public verifySignature(rawBody: string, signature: string): boolean {
    if (!this.secret || !signature) {
      throw new AppError('Missing webhook secret or signature', 401);
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(rawBody)
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return true;
    }
    
    throw new AppError('Invalid Esca webhook signature', 401);
  }
}

export const escaWebhooks = new EscaWebhooks();
