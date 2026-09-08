import axios from 'axios';
import { AppError } from '../../shared/utils/AppError';

export class BridgeClient {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.BRIDGE_API_BASE_URL || 'https://api.sandbox.bridge.xyz';
    this.apiKey = process.env.BRIDGE_API_KEY || '';
  }

  private get headers() {
    return {
      'Api-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  public async createCustomer(customerData: any, idempotencyKey: string) {
    try {
      const response = await axios.post(`${this.baseURL}/v0/customers`, customerData, {
        headers: {
          ...this.headers,
          'Idempotency-Key': idempotencyKey
        },
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  public async createExternalAccount(customerId: string, accountData: any, idempotencyKey: string) {
    try {
      const response = await axios.post(`${this.baseURL}/v0/customers/${customerId}/external_accounts`, accountData, {
        headers: {
          ...this.headers,
          'Idempotency-Key': idempotencyKey
        },
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  public async createTransfer(transferData: any, idempotencyKey: string) {
    try {
      const response = await axios.post(`${this.baseURL}/v0/transfers`, transferData, {
        headers: {
          ...this.headers,
          'Idempotency-Key': idempotencyKey
        },
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  private handleError(error: any) {
    console.error('[BridgeClient] API Error:', error.response?.data || error.message);
    throw new AppError(`Bridge API Error: ${error.response?.data?.message || error.message}`, error.response?.status || 500);
  }
}

export const bridgeClient = new BridgeClient();
