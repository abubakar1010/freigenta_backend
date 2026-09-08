import crypto from 'crypto';
import { AppError } from '../../shared/utils/AppError';

export class BridgeWebhooks {
  private publicKeyPem: string;

  constructor() {
    this.publicKeyPem = process.env.BRIDGE_WEBHOOK_PUBLIC_KEY_PEM || '';
  }

  /**
   * Verifies the Bridge webhook signature according to Section 25.
   * X-Webhook-Signature: t=<timestamp>,v0=<base64-signature>
   */
  public verifySignature(rawBody: string, signatureHeader: string): boolean {
    if (!this.publicKeyPem || !signatureHeader) {
      throw new AppError('Missing webhook public key or signature header', 401);
    }

    // 1 & 2: Parse timestamp and base64 signature
    const parts = signatureHeader.split(',');
    let timestamp = '';
    let b64Signature = '';

    for (const part of parts) {
      if (part.startsWith('t=')) timestamp = part.substring(2);
      if (part.startsWith('v0=')) b64Signature = part.substring(3);
    }

    if (!timestamp || !b64Signature) {
      throw new AppError('Invalid Bridge signature format', 401);
    }

    // 8: Reject stale events (e.g. older than 10 mins)
    const eventTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - eventTime) > 600) {
      throw new AppError('Stale webhook event', 401);
    }

    // 4: Join timestamp and raw body using a period
    const payloadToSign = `${timestamp}.${rawBody}`;

    // 5 & 6 & 7: Verify using Bridge public key
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(payloadToSign);
      
      const isValid = verifier.verify(this.publicKeyPem, b64Signature, 'base64');
      if (!isValid) {
        throw new AppError('Invalid Bridge webhook signature', 401);
      }
      return true;
    } catch (err) {
      throw new AppError('Failed to verify Bridge webhook signature', 500);
    }
  }
}

export const bridgeWebhooks = new BridgeWebhooks();
