import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { Invoice } from "../../../shared/models/invoice.model";
import { User } from "../../../shared/models/user.model";
import { BridgeService } from "../../../shared/services/bridge.service";
import { logAudit } from "../../../shared/utils/audit";
import { AppError } from "../../../shared/utils/AppError";

export class SettlementService {
    async approveSettlement(transactionId: string, adminUserId: string, ip?: string) {
        // We simulate a database lock by finding a transaction that is NOT yet PROCESSING or COMPLETED
        const paymentOrder = await PaymentOrder.findOne({
            _id: transactionId,
            status: { $in: ["VERIFIED_PENDING_SETTLEMENT"] }
        });

        if (!paymentOrder) {
            throw new AppError("PaymentOrder not found or settlement already initiated/completed.", 400);
        }

        const invoice = await Invoice.findById(paymentOrder.invoiceId);
        if (!invoice) {
            throw new AppError("Associated invoice not found.", 404);
        }

        const user = await User.findById(paymentOrder.customerId);
        if (!user || !user.bridgeCustomerId) {
            throw new AppError("Customer Bridge ID missing. Cannot initiate settlement.", 400);
        }

        // Optimistically set to PROCESSING to prevent duplicates
        paymentOrder.status = "PAYOUT_PROCESSING";
        await paymentOrder.save();

        try {
            const bridgeService = new BridgeService();
            
            // 1. Create/Validate Beneficiary with actual data
            // We use extracted invoice data for bank details, falling back to an error if missing
            if (!invoice.extractedData || !invoice.extractedData.routingNumber || !invoice.extractedData.accountNumber) {
                throw new AppError("Missing carrier routing/account numbers on the invoice.", 400);
            }

            const beneficiaryId = await bridgeService.createBeneficiary({
                name: invoice.carrier,
                accountDetails: {
                    routingNumber: invoice.extractedData.routingNumber,
                    accountNumber: invoice.extractedData.accountNumber
                }
            });

            // 2. Initiate Settlement
            const settlement = await bridgeService.initiateSettlement({
                onBehalfOf: user.bridgeCustomerId,
                beneficiaryId,
                amount: paymentOrder.beneficiaryAmount || invoice.amount,
                currency: invoice.currency || "USD",
                reference: paymentOrder._id.toString()
            });

            // Depending on Bridge's sync response, it might be PENDING or COMPLETED
            paymentOrder.status = settlement.status === "COMPLETED" ? "COMPLETED" : "PAYOUT_PROCESSING";
            await paymentOrder.save();

            if (paymentOrder.status === "COMPLETED") {
                invoice.status = "COMPLETED";
                await invoice.save();
            }

            await logAudit(
                adminUserId,
                "SETTLEMENT_APPROVED",
                paymentOrder._id.toString(),
                { status: "VERIFIED_PENDING_SETTLEMENT" },
                { status: paymentOrder.status, settlementId: settlement.settlementId },
                ip
            );

            return paymentOrder;
        } catch (error) {
            // Revert status on failure
            paymentOrder.status = "FAILED";
            await paymentOrder.save();
            throw error;
        }
    }
}
