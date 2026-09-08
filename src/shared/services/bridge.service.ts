import axios from 'axios';
import { AppError } from '../utils/AppError';

export class BridgeService {
    private isSandbox = process.env.USE_SANDBOX === 'true';
    private baseUrl = process.env.BRIDGE_API_URL || 'https://api.bridge.xyz/v1';
    private apiKey = process.env.BRIDGE_API_KEY || 'test_bridge_key';

    /**
     * Creates or validates a carrier beneficiary for payout settlement.
     */
    async createBeneficiary(carrierDetails: { name: string; accountDetails: any; }): Promise<string> {
        if (this.isSandbox) {
            // Return a mocked beneficiary ID
            return `ben_${Math.random().toString(36).substring(2, 10)}`;
        }

        try {
            const response = await axios.post(`${this.baseUrl}/beneficiaries`, carrierDetails, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return response.data.id;
        } catch (error: any) {
            console.error('[BridgeService] Failed to create beneficiary:', error.message);
            throw new AppError('Failed to create/validate carrier beneficiary via Bridge API', 502);
        }
    }

    /**
     * Initiates the settlement/payout instruction via Bridge.
     */
    async initiateSettlement(payload: { onBehalfOf: string; beneficiaryId: string; amount: number; currency: string; reference: string }): Promise<{ settlementId: string; status: string }> {
        if (this.isSandbox) {
            return {
                settlementId: `set_${Math.random().toString(36).substring(2, 10)}`,
                status: 'PROCESSING'
            };
        }

        try {
            const bridgeWalletId = process.env.BRIDGE_TREASURY_WALLET_ID || 'wallet_dev';
            
            // Bridge Transfer V0 API payload
            const response = await axios.post(`${this.baseUrl.replace('/v1', '/v0')}/transfers`, {
                amount: payload.amount.toString(),
                client_reference_id: payload.reference,
                on_behalf_of: payload.onBehalfOf,
                source: {
                    payment_rail: "bridge_wallet",
                    currency: "usdc",
                    bridge_wallet_id: bridgeWalletId
                },
                destination: {
                    payment_rail: "ach", // Adjust dynamically if multiple rails exist
                    currency: payload.currency.toLowerCase(),
                    external_account_id: payload.beneficiaryId
                }
            }, {
                headers: { 'Api-Key': this.apiKey, 'Content-Type': 'application/json' }
            });

            return {
                settlementId: response.data.id,
                status: response.data.state || response.data.status
            };
        } catch (error: any) {
            console.error('[BridgeService] Failed to initiate settlement:', error.response?.data || error.message);
            throw new AppError('Failed to initiate settlement via Bridge API', 502);
        }
    }
}
