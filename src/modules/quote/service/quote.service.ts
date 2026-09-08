import { Quote } from "../../../shared/models/quote.model";
import { Invoice } from "../../../shared/models/invoice.model";
import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { logAudit } from "../../../shared/utils/audit";
import { AppError } from "../../../shared/utils/AppError";
import { EscaService } from "../../../shared/services/esca.service";

export class QuoteService {
  async generateQuote(invoiceId: string, opsUserId: string, ip?: string) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    // Fetch dynamic rate from Esca
    const escaService = new EscaService();
    // Assuming invoice currency is USD (or from invoice.currency) and we are collecting in NGN
    const conversionRate = await escaService.getConversionRate(invoice.currency || "USD", "NGN");

    // Quote Calculation (Section 9.1 requirements)
    const freightInvoiceAmount = invoice.amount;
    const freigentaTransactionFee = 0.025; // 2.5%
    const freigentaFXMargin = 0.0025; // 0.25%

    // Total = Base Amount * Rate * (1 + 0.025 + 0.0025)
    const amountPayable = freightInvoiceAmount * conversionRate * (1 + freigentaTransactionFee + freigentaFXMargin);
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expires in 24 hours

    const quote = await Quote.create({
      invoiceId,
      amountPayable,
      paymentCurrency: "NGN",
      freightInvoiceAmount,
      conversionRate,
      freigentaTransactionFee,
      freigentaFXMargin,
      expiryDate,
      status: "READY",
    });

    invoice.status = "QUOTE_READY";
    await invoice.save();

    await logAudit(
      opsUserId,
      "QUOTE_GENERATED",
      quote._id.toString(),
      undefined,
      { quoteId: quote._id, invoiceId, amountPayable, expiryDate },
      ip
    );

    return quote;
  }

  async respondToQuote(id: string, action: "ACCEPT" | "DECLINE", userId: string, ip?: string) {
    const quote = await Quote.findById(id);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }

    if (new Date() > quote.expiryDate) {
      quote.status = "EXPIRED";
      await quote.save();
      throw new AppError("This quote has expired and cannot be accepted.", 400);
    }

    if (action === "ACCEPT") {
      quote.status = "ACCEPTED";
      await quote.save();

      // Update invoice status correctly
      const invoice = await Invoice.findById(quote.invoiceId);
      if (invoice) {
        invoice.status = "AWAITING_PAYMENT"; 
        await invoice.save();
      }

      // Use the shared Esca virtual account instead of generating a new one
      const paymentReference = `freigenta-${Date.now()}`;
      const virtualBankName = "Esca Default Bank";
      const virtualAccountNumber = process.env.ESCA_NGN_VIRTUAL_ACCOUNT_ID || "not_configured";

      // Create or update PaymentOrder record (Section 10.1 requirements)
      const paymentOrder = await PaymentOrder.create({
        transactionReference: paymentReference,
        customerId: userId,
        invoiceId: quote.invoiceId,
        invoiceCurrency: invoice?.currency || "USD",
        invoiceAmount: invoice?.amount || 0,
        collectionCurrency: quote.paymentCurrency,
        expectedCollectionAmount: quote.amountPayable,
        serviceFee: quote.amountPayable * quote.freigentaTransactionFee, // Approx fee in NGN
        fxMargin: quote.amountPayable * quote.freigentaFXMargin,
        beneficiaryAmount: invoice?.amount || 0,
        quoteRate: quote.conversionRate,
        quoteExpiry: quote.expiryDate,
        escaVirtualAccountId: virtualAccountNumber,
        status: "AWAITING_PAYMENT",
      });

      await logAudit(
        userId,
        "QUOTE_ACCEPTED",
        quote._id.toString(),
        { status: "READY" },
        { status: "ACCEPTED", transactionId: paymentOrder._id },
        ip
      );

      return { quote, transaction: paymentOrder };
    } else {
      quote.status = "DECLINED";
      await quote.save();

      await logAudit(
        userId,
        "QUOTE_DECLINED",
        quote._id.toString(),
        { status: "READY" },
        { status: "DECLINED" },
        ip
      );

      return { quote };
    }
  }

  async getCustomerQuotes(userId: string) {
    const invoices = await Invoice.find({ customerId: userId });
    const invoiceIds = invoices.map(inv => inv._id);

    return Quote.find({ invoiceId: { $in: invoiceIds } }).populate("invoiceId").sort({ createdAt: -1 });
  }

  async getOpsQuotes() {
    return Quote.find().populate("invoiceId").sort({ createdAt: -1 });
  }
}
