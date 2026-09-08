import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { Invoice } from "../../../shared/models/invoice.model";
import { Quote } from "../../../shared/models/quote.model";
import { EscaService } from "../../../shared/services/esca.service";

export class AdminTransactionsService {
  /**
   * Helper function to map a Mongoose Transaction document (fully populated)
   * to the clean DTO expected by the frontend.
   * Centralizing this translation layer makes future changes extremely easy.
   */
  private mapTransactionToDto(tx: any) {
    const invoice = tx.invoiceId || {};
    const customer = tx.customerId || {};

    const customerName =
      customer.companyInfo?.legalCompanyName ||
      (customer.firstName && customer.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : "Unknown Customer");

    const origin = invoice.extractedData?.routeFrom || "Hamburg";
    const destination = invoice.extractedData?.routeTo || "Lagos";
    const amount = invoice.amount || tx.expectedCollectionAmount || 0;

    // Status mapping: Maps rich backend states to simplified frontend tags
    // Approved, Processing, Pending, Flagged_Blue, Flagged_Red
    let status:
      | "Approved"
      | "Processing"
      | "Pending"
      | "Flagged_Blue"
      | "Flagged_Red" = "Pending";

    if (tx.status === "COMPLETED") {
      status = "Approved";
    } else if (
      tx.status === "FAILED" ||
      tx.status === "CANCELED" ||
      tx.status === "VERIFICATION_FAILED" ||
      tx.status === "REFUND_PENDING" ||
      tx.status === "REFUND_PROCESSING" ||
      tx.status === "REFUNDED"
    ) {
      status = "Flagged_Red";
    } else if (
      tx.status === "MANUAL_REVIEW" ||
      tx.status === "PAYMENT_UNDERPAID" ||
      tx.status === "PAYMENT_OVERPAID" ||
      tx.status === "PAYMENT_REVIEW_REQUIRED"
    ) {
      status = "Flagged_Blue";
    } else if (
      tx.status === "DRAFT" ||
      tx.status === "DOCUMENT_RECEIVED" ||
      tx.status === "QUOTE_READY" ||
      tx.status === "AWAITING_PAYMENT" ||
      tx.status === "CUSTOMER_ACTION_REQUIRED"
    ) {
      status = "Pending";
    } else {
      status = "Processing";
    }

    return {
      id: `PAY-${tx._id.toString().slice(-6).toUpperCase()}`,
      dbId: tx._id.toString(),
      invoice: invoice.invoiceNo || "N/A",
      customerName,
      carrier: invoice.carrier || "N/A",
      origin,
      destination,
      amount,
      status,
      createdAt: tx.createdAt || new Date(),
    };
  }

  /**
   * Automatically seed transaction records if none exist in the database,
   * using existing invoices and customers to ensure realistic operational data.
   */
  private async ensureSeedData() {
    if (process.env.NODE_ENV === "production") return;
    const count = await PaymentOrder.countDocuments({});
    if (count > 0) return;

    // Fetch existing invoices to create transactions for
    const invoices = await Invoice.find({}).limit(10);
    if (invoices.length === 0) return;

    const escaService = new EscaService();
    const conversionRate = await escaService.getConversionRate("USD", "NGN");

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];

      // Determine dummy statuses for seeded data
      let status: any = "COMPLETED";

      if (i % 5 === 0) {
        status = "AWAITING_PAYMENT";
      } else if (i % 5 === 1) {
        status = "PAYMENT_RECEIVED";
      } else if (i % 5 === 2) {
        status = "REFUNDED";
      } else if (i % 5 === 3) {
        status = "MANUAL_REVIEW";
      }

      // Create a dummy quote if it doesn't exist
      let quote = await Quote.findOne({ invoiceId: inv._id });
      if (!quote) {
        quote = await Quote.create({
          invoiceId: inv._id,
          amountPayable: inv.amount * conversionRate * (1 + 0.025 + 0.0025),
          paymentCurrency: "NGN",
          freightInvoiceAmount: inv.amount,
          conversionRate,
          freigentaTransactionFee: 0.025,
          freigentaFXMargin: 0.0025,
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "ACCEPTED",
        });
      }

      await PaymentOrder.create({
        invoiceId: inv._id,
        customerId: inv.customerId,
        status,
        collectionCurrency: "NGN",
        expectedCollectionAmount: quote.amountPayable,
        invoiceCurrency: inv.currency || "USD",
        invoiceAmount: inv.amount,
        beneficiaryAmount: inv.amount,
        quoteRate: quote.conversionRate,
        quoteExpiry: quote.expiryDate,
        transactionReference: `REF-${inv.invoiceNo.split("-")[1] || "000"}`,
      });
    }
  }

  async getTransactions(params: {
    page?: number;
    limit?: number;
    statusFilter?: string;
    searchQuery?: string;
  }) {
    // Check if we need to auto-seed
    await this.ensureSeedData();

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 10);
    const { statusFilter, searchQuery } = params;

    // aggregation pipeline for high performance joins and query scaling
    const pipeline: any[] = [];

    // 1. Join with Invoices
    pipeline.push({
      $lookup: {
        from: "invoices",
        localField: "invoiceId",
        foreignField: "_id",
        as: "invoice",
      },
    });
    pipeline.push({
      $unwind: { path: "$invoice", preserveNullAndEmptyArrays: true },
    });

    // 2. Join with Users
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    });
    pipeline.push({
      $unwind: { path: "$customer", preserveNullAndEmptyArrays: true },
    });

    // 3. Apply search query
    const matchConditions: any[] = [];

    if (searchQuery && searchQuery.trim() !== "") {
      const searchRegex = { $regex: searchQuery.trim(), $options: "i" };
      matchConditions.push({
        $or: [
          { transactionReference: searchRegex },
          { "invoice.invoiceNo": searchRegex },
          { "invoice.carrier": searchRegex },
          { "customer.firstName": searchRegex },
          { "customer.lastName": searchRegex },
          { "customer.companyInfo.legalCompanyName": searchRegex },
        ],
      });
    }

    if (statusFilter && statusFilter !== "All") {
      if (statusFilter === "Approved") {
        matchConditions.push({ status: "COMPLETED" });
      } else if (statusFilter === "Pending") {
        matchConditions.push({
          status: { $in: ["DRAFT", "DOCUMENT_RECEIVED", "QUOTE_READY", "AWAITING_PAYMENT", "CUSTOMER_ACTION_REQUIRED"] },
        });
      } else if (statusFilter === "Processing") {
        matchConditions.push({
          status: { $in: ["PAYMENT_RECEIVED", "PAID_PENDING_VERIFICATION", "UNDER_VERIFICATION", "VERIFIED_PENDING_SETTLEMENT", "SETTLEMENT_APPROVAL_PENDING", "ESCA_CONVERSION_PENDING", "ESCA_CONVERSION_PROCESSING", "ESCA_CONVERSION_COMPLETED", "ESCA_TRANSFER_TO_BRIDGE_PENDING", "ESCA_TRANSFER_TO_BRIDGE_SUBMITTED", "BRIDGE_FUNDING_PENDING", "BRIDGE_FUNDS_RECEIVED", "PAYOUT_PENDING", "PAYOUT_SUBMITTED", "PAYOUT_PROCESSING", "CARRIER_PAID", "RECONCILIATION_PENDING"] },
        });
      } else if (statusFilter === "Flagged") {
        matchConditions.push({
          status: { $in: ["PAYMENT_UNDERPAID", "PAYMENT_OVERPAID", "PAYMENT_REVIEW_REQUIRED", "VERIFICATION_FAILED", "REFUND_PENDING", "REFUND_PROCESSING", "REFUNDED", "MANUAL_REVIEW", "FAILED", "CANCELED"] },
        });
      }
    }

    if (matchConditions.length > 0) {
      pipeline.push({ $match: { $and: matchConditions } });
    }

    // Calculate total matching records
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await PaymentOrder.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Sorting & Pagination
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const rawTxs = await PaymentOrder.aggregate(pipeline);

    // Map using clean mapper
    const transactions = rawTxs.map((tx) => {
      return this.mapTransactionToDto({
        ...tx,
        invoiceId: tx.invoice,
        customerId: tx.customer,
      });
    });

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

