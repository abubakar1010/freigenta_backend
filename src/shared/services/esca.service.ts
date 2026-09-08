import axios from 'axios';
import { AppError } from '../utils/AppError';

export class EscaService {
    private isSandbox = process.env.USE_SANDBOX === 'true';
    private baseUrl = process.env.ESCA_API_URL || 'https://api.escafinance.com/v1';
    private apiKey = process.env.ESCA_API_KEY || 'test_key';

    /**
     * Gets the current conversion rate.
     */
    async getConversionRate(fromCurrency: string, toCurrency: string): Promise<number> {
        if (this.isSandbox) {
            // Mock conversion rate logic
            if (fromCurrency === 'NGN' && toCurrency === 'USD') return 0.00067; // approx 1500 NGN/USD
            if (fromCurrency === 'USD' && toCurrency === 'NGN') return 1500;
            return 1.0;
        }

        try {
            const response = await axios.get(`${this.baseUrl}/rates`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                params: { from: fromCurrency, to: toCurrency }
            });
            return response.data.rate;
        } catch (error: any) {
            console.error('[EscaService] Failed to fetch conversion rate:', error.message);
            throw new AppError('Failed to fetch conversion rate from Esca Finance', 502);
        }
    }

    /**
     * Generates a transaction-linked virtual account for collecting payments.
     */
    async generateVirtualAccount(payload: { customerId: string, quoteId: string }): Promise<{ bankName: string, accountNumber: string, paymentReference: string }> {
        if (this.isSandbox) {
            return {
                bankName: 'Esca Sandbox Bank',
                accountNumber: `90${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
                paymentReference: `ESCA-REF-${Date.now().toString().slice(-8)}`
            };
        }

        try {
            const response = await axios.post(`${this.baseUrl}/virtual-accounts`, payload, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return {
                bankName: response.data.bankName,
                accountNumber: response.data.accountNumber,
                paymentReference: response.data.reference
            };
        } catch (error: any) {
            console.error('[EscaService] Failed to generate virtual account:', error.message);
            throw new AppError('Failed to generate virtual account via Esca Finance', 502);
        }
    }
}
