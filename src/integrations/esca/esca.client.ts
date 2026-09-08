import axios from 'axios';
import { AppError } from '../../shared/utils/AppError';

export class EscaClient {
  private baseURL: string;
  private apiKey: string;

  constructor() {
    this.baseURL = process.env.ESCA_API_BASE_URL || 'https://api.sandbox.esca.com';
    this.apiKey = process.env.ESCA_API_KEY || '';
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  public async createVirtualAccount(transactionId: string, amount: number) {
    try {
      const response = await axios.post(`${this.baseURL}/v1/virtual-accounts`, {
        reference: transactionId,
        expected_amount: amount,
      }, {
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  public async requestFxQuote(sourceCurrency: string, destinationCurrency: string, amount: number) {
    try {
      const response = await axios.post(`${this.baseURL}/v1/fx/quotes`, {
        source_currency: sourceCurrency,
        destination_currency: destinationCurrency,
        amount: amount
      }, {
        headers: this.headers,
      });
      return response.data;
    } catch (error: any) {
      this.handleError(error);
    }
  }

  public async executeConversion(quoteId: string, accountId: string, idempotencyKey: string) {
    try {
      const response = await axios.post(`${this.baseURL}/v1/fx/convert`, {
        quote_id: quoteId,
        account_id: accountId
      }, {
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

  public async sendStablecoin(amount: number, destinationAddress: string, idempotencyKey: string) {
    try {
      const protocol = process.env.ESCA_PAYOUT_PROTOCOL || 'SOLANA';
      const currency = process.env.ESCA_PAYOUT_CURRENCY || 'USDC';
      const beneficiaryName = process.env.ESCA_PAYOUT_BENEFICIARY_NAME || 'Diophir Digital Labs';

      const response = await axios.post(`${this.baseURL}/v1/payouts/crypto`, {
        amount,
        address: destinationAddress,
        currency,
        protocol,
        beneficiaryName
      }, {
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
    console.error('[EscaClient] API Error:', error.response?.data || error.message);
    throw new AppError(`Esca API Error: ${error.response?.data?.message || error.message}`, error.response?.status || 500);
  }
}

export const escaClient = new EscaClient();
