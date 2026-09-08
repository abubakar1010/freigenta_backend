import axios from 'axios';
import { AppError } from '../../shared/utils/AppError';

export class FindTEUClient {
  private baseURL: string;
  private apiKey: string;
  private maxRetries: number;

  constructor() {
    this.baseURL = process.env.FINDTEU_API_BASE_URL || 'https://api.findteu.com';
    this.apiKey = process.env.FINDTEU_API_KEY || '';
    this.maxRetries = parseInt(process.env.FINDTEU_MAX_RETRIES || '3', 10);
  }

  private get headers() {
    return {
      'X-Authorization-ApiKey': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  public async trackShipment(trackingNumber: string, type: 'CONTAINER' | 'BOOKING') {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        const response = await axios.post(`${this.baseURL}/v1/tracking`, {
          trackingNumber,
          type,
          webhookUrl: process.env.FINDTEU_WEBHOOK_URL
        }, {
          headers: this.headers,
          timeout: parseInt(process.env.FINDTEU_REQUEST_TIMEOUT_MS || '10000', 10)
        });
        return response.data;
      } catch (error: any) {
        attempts++;
        if (attempts >= this.maxRetries) {
          console.error('[FindTEUClient] API Error after max retries:', error.response?.data || error.message);
          throw new AppError(`FindTEU API Error: ${error.message}`, 502);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }
}

export const findTeuClient = new FindTEUClient();
