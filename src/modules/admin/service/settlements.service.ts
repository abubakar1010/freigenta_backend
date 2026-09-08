import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { Invoice } from "../../../shared/models/invoice.model";
import { AppError } from "../../../shared/utils/AppError";

export class AdminSettlementsService {
  /**
   * Helper function to map a database transaction record to the settlement DTO
   */
  private mapToSettlementDto(tx: any) {
    const invoice = tx.invoiceId || {};
    
    let status: "Pending" | "Processing" | "Approved" | "Failed" = "Pending";
    
    if (tx.status === "COMPLETED") {
      status = "Approved";
    } else if (["PAYOUT_PROCESSING", "VERIFIED_PENDING_SETTLEMENT", "SETTLEMENT_APPROVAL_PENDING", "PAYOUT_SUBMITTED", "BRIDGE_FUNDS_RECEIVED", "BRIDGE_FUNDING_PENDING", "ESCA_TRANSFER_TO_BRIDGE_SUBMITTED", "ESCA_TRANSFER_TO_BRIDGE_PENDING", "ESCA_CONVERSION_COMPLETED", "ESCA_CONVERSION_PROCESSING", "ESCA_CONVERSION_PENDING"].includes(tx.status)) {
      status = "Processing";
    } else if (["FAILED", "VERIFICATION_FAILED", "CANCELED", "REFUND_PENDING", "REFUND_PROCESSING", "REFUNDED"].includes(tx.status)) {
      status = "Failed";
    }

    const rawDate = tx.updatedAt || tx.createdAt;
    
    return {
      id: `SET-${tx._id.toString().slice(-6).toUpperCase()}`,
      dbId: tx._id.toString(),
      invoice: invoice.invoiceNo || "N/A",
      company: invoice.carrier || "Unknown Carrier",
      amount: invoice.amount || tx.expectedCollectionAmount || 0,
      currency: invoice.currency || "USD",
      status,
      settlementDate: status === "Approved" && rawDate ? new Date(rawDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) : null
    };
  }

  async getSettlements(statusFilter: string, dateFilter?: string) {
    // 1. Fetch transactions with populated Invoices
    const query: any = {};
    if (dateFilter) {
      const start = new Date(dateFilter);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilter);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const txs = await PaymentOrder.find(query)
      .populate("invoiceId")
      .populate("customerId")
      .sort({ createdAt: -1 });

    // 2. Map all transactions to DTOs
    const allSettlements = txs.map(tx => this.mapToSettlementDto(tx));

    // 3. Compute Metrics dynamically
    let totalSum = 0;
    let pendingSum = 0;
    let completedSum = 0;
    let failedSum = 0;

    let pendingCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    allSettlements.forEach(s => {
      totalSum += s.amount;
      if (s.status === "Pending" || s.status === "Processing") {
        pendingSum += s.amount;
        pendingCount++;
      } else if (s.status === "Approved") {
        completedSum += s.amount;
        completedCount++;
      } else if (s.status === "Failed") {
        failedSum += s.amount;
        failedCount++;
      }
    });

    const formatMetricValue = (val: number) => {
      if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
      return `$${val.toLocaleString()}`;
    };

    const metrics = [
      {
        id: "total",
        title: "Total Settlements",
        value: formatMetricValue(totalSum),
        subtext: "Cumulative volume",
      },
      {
        id: "pending",
        title: "Pending Settlements",
        value: formatMetricValue(pendingSum),
        subtext: `${pendingCount} Processing`,
      },
      {
        id: "completed",
        title: "Completed Settlements",
        value: formatMetricValue(completedSum),
        subtext: `${completedCount} Paid`,
      },
      {
        id: "failed",
        title: "Failed Settlements",
        value: formatMetricValue(failedSum),
        subtext: `${failedCount} Flags`,
      },
    ];

    // 4. Filter by selected Tab status
    let filteredSettlements = allSettlements;
    if (statusFilter && statusFilter !== "All Settlements") {
      filteredSettlements = allSettlements.filter(s => s.status.toLowerCase() === statusFilter.toLowerCase());
    }

    return {
      settlements: filteredSettlements,
      metrics
    };
  }

  async updateSettlementStatus(id: string, action: "start" | "complete") {
    const paymentOrder = await PaymentOrder.findById(id);
    if (!paymentOrder) {
      throw new AppError("PaymentOrder record not found", 404);
    }

    if (action === "start") {
      if (paymentOrder.status !== "VERIFIED_PENDING_SETTLEMENT" && paymentOrder.status !== "PAYOUT_PROCESSING") {
        throw new AppError("Invalid transaction state.", 400);
      }
      paymentOrder.status = "PAYOUT_PROCESSING";
      await paymentOrder.save();
    } else if (action === "complete") {
      if (paymentOrder.status !== "PAYOUT_PROCESSING") {
        throw new AppError("Invalid transaction state for completion.", 400);
      }
      paymentOrder.status = "COMPLETED";

      // Mark the invoice itself as COMPLETED in the database
      if (paymentOrder.invoiceId) {
        await Invoice.findByIdAndUpdate(paymentOrder.invoiceId, { status: "COMPLETED" });
      }
    }

    await paymentOrder.save();

    // Fetch the updated populated transaction to return to client
    const updatedTx = await PaymentOrder.findById(id).populate("invoiceId").populate("customerId");
    return this.mapToSettlementDto(updatedTx);
  }
}
