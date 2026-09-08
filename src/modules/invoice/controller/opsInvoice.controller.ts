import { Request, Response, NextFunction } from "express";
import { Invoice } from "../../../shared/models/invoice.model";
import { Quote } from "../../../shared/models/quote.model";
import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { AuditLog } from "../../../shared/models/audit.model";
import { AppError } from "../../../shared/utils/AppError";
import { AuthenticatedRequest } from "../../../shared/middlewares/auth.middleware";

/**
 * Shared helper that fetches and assembles the full invoice detail object.
 * Used by both getOpsInvoiceDetail and getCustomerInvoiceDetail.
 * Does NOT enforce ownership — that is the responsibility of the calling handler.
 */
const fetchInvoiceDetail = async (invoiceId: string) => {
  const invoice = await Invoice.findById(invoiceId).populate(
    "customerId",
    "firstName lastName emailAddress companyInfo"
  );
  if (!invoice) throw new AppError("Invoice not found", 404);

  const customer = invoice.customerId as any;
  const customerName =
    customer?.companyInfo?.legalCompanyName ||
    (customer ? `${customer.firstName} ${customer.lastName}`.trim() : "Unknown");

  const colorMap: Record<string, string> = {
    UPLOADED: "amber", PROCESSING: "amber", MANUAL_REVIEW: "amber",
    QUOTE_READY: "purple", AWAITING_PAYMENT: "blue",
    SETTLING: "indigo", COMPLETED: "green",
    REJECTED: "red", CANCELLED: "red",
  };

  const stageMap: Record<string, string> = {
    UPLOADED: "Verification", PROCESSING: "Verification", MANUAL_REVIEW: "Verification",
    QUOTE_READY: "Quote Generated", AWAITING_PAYMENT: "Awaiting Payment",
    SETTLING: "Settling", COMPLETED: "Completed",
    REJECTED: "Flag", CANCELLED: "Flag",
  };

  const stageDetailMap: Record<string, string> = {
    UPLOADED: "Under OCR review", PROCESSING: "Processing documents",
    MANUAL_REVIEW: "Awaiting manual review", QUOTE_READY: "Quote generated & sent",
    AWAITING_PAYMENT: "Awaiting client deposit", SETTLING: "Sending to Carrier",
    COMPLETED: "Paid & settled", REJECTED: "Invoice rejected", CANCELLED: "Invoice cancelled",
  };

  const routeFrom = invoice.extractedData?.routeFrom || "Hamburg";
  const routeTo = invoice.extractedData?.routeTo || "Lagos";
  const currentStatus = invoice.status;

  const detailHeader = {
    id: invoice._id.toString(),
    invoiceNo: invoice.invoiceNo,
    shipmentNo: invoice.extractedData?.shipmentNo || `SHP-${invoice.invoiceNo.split("-")[1] || "000"}`,
    carrier: invoice.carrier,
    route: `${routeFrom} → ${routeTo}`,
    submittedDate: invoice.createdAt
      ? new Date(invoice.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "Pending",
    customer: customerName,
    stage: stageMap[currentStatus] || "Verification",
    stageDetail: stageDetailMap[currentStatus] || "Under review",
    stageColor: colorMap[currentStatus] || "amber",
  };

  const timelineSteps = [
    { id: 1, title: "Invoice Uploaded", subtitle: "Invoice and supporting documents received.", status: "Completed", date: invoice.createdAt ? new Date(invoice.createdAt).toLocaleString("en-US", { hour12: true }) : undefined },
    { id: 2, title: "Invoice Verified", subtitle: "Reviewed by operations team.", status: ["UPLOADED"].includes(currentStatus) ? "Awaiting" : "Completed" },
    { id: 3, title: "Quote Generated", subtitle: "FX and settlement quote generated.", status: ["UPLOADED", "PROCESSING", "MANUAL_REVIEW"].includes(currentStatus) ? "Pending" : "Completed" },
    { id: 4, title: "Quote Accepted", subtitle: "Customer accepted the generated quote.", status: ["UPLOADED", "PROCESSING", "MANUAL_REVIEW", "QUOTE_READY"].includes(currentStatus) ? "Pending" : "Completed" },
    { id: 5, title: "NGN Deposit Received", subtitle: "Awaiting customer deposit.", status: ["UPLOADED", "PROCESSING", "MANUAL_REVIEW", "QUOTE_READY", "AWAITING_PAYMENT"].includes(currentStatus) ? "Pending" : "Completed" },
    { id: 6, title: "Settlement Initiated", subtitle: "FX conversion and settlement.", status: currentStatus === "SETTLING" ? "Awaiting" : currentStatus === "COMPLETED" ? "Completed" : "Pending" },
    { id: 7, title: "Completed", subtitle: "Carrier payment confirmed.", status: currentStatus === "COMPLETED" ? "Completed" : "Pending" },
  ];

  const docList = invoice.extractedData?.documents || [
    { type: "Commercial Invoice", name: "invoice.pdf", url: invoice.fileUrl, size: "Unknown" },
  ];

  const documents = docList.map((doc: any, index: number) => ({
    id: String(index + 1),
    type: doc.type,
    fileName: doc.name,
    fileSize: doc.size || "Unknown",
    uploaded: invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-GB") : "Pending",
    status: "Uploaded",
    url: doc.url,
  }));

  const paymentOrder = await PaymentOrder.findOne({ invoiceId: invoice._id });
  const quote = await Quote.findOne({ invoiceId: invoice._id });

  const settlement = {
    invoiceNo: invoice.invoiceNo,
    paymentId: quote ? `PAY-${quote._id.toString().slice(-6).toUpperCase()}` : "Pending",
    carrier: invoice.carrier,
    route: `${routeFrom} → ${routeTo}`,
    quoteStatus: quote ? (quote.status === "ACCEPTED" ? "Accepted" : "Generated") : "Not Started",
    invoiceAmount: `$ ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${invoice.currency}`,
    settlementDate: paymentOrder?.updatedAt ? new Date(paymentOrder.updatedAt).toLocaleString("en-US") : "Pending",
    settlementMethod: "Bank Transfer (SWIFT)",
    transactionReference: paymentOrder?.transactionReference || "Pending",
    paymentStatus: paymentOrder?.status || "Pending",
    settlementStatus: paymentOrder?.status || "Pending",
  };

  const auditLogs = await AuditLog.find({ relatedRecordId: invoice._id.toString() }).sort({ createdAt: -1 });
  const activities = auditLogs.map((log: any, index: number) => ({
    id: String(index + 1),
    title: log.event.replace(/_/g, " "),
    description: log.event === "INVOICE_UPLOADED" ? `Customer uploaded Invoice ${invoice.invoiceNo}.`
      : log.event === "INVOICE_DATA_CORRECTED" ? "Operations team corrected invoice details."
      : log.event === "QUOTE_GENERATED" ? "Quote generated and sent to customer."
      : "Activity recorded.",
    date: log.createdAt ? new Date(log.createdAt).toLocaleString("en-US") : "Pending",
  }));

  const notes = invoice.extractedData?.notes || [];

  return {
    invoice: detailHeader,
    timeline: timelineSteps,
    documents,
    settlement,
    activities,
    notes,
    // Internal field used for ownership checks — NOT sent to clients directly,
    // only used before the response is assembled.
    _ownerId: (invoice.customerId as any)?._id?.toString() || invoice.customerId?.toString(),
  };
};

/**
 * GET /api/invoices/ops/:id
 * Staff-only. Returns full detail for any invoice — no ownership restriction.
 */
export const getOpsInvoiceDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const detail = await fetchInvoiceDetail(req.params.id as string);
    const { _ownerId, ...clientDetail } = detail;
    res.status(200).json({ success: true, data: clientDetail });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/customer/:id
 * Customer-only. Enforces that the invoice belongs to the authenticated user.
 */
export const getCustomerInvoiceDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    const detail = await fetchInvoiceDetail(req.params.id as string);

    // Ownership check: customer can only view their own invoices
    if (detail._ownerId !== userId) {
      throw new AppError("Forbidden: you do not have access to this invoice", 403);
    }

    const { _ownerId, ...clientDetail } = detail;
    res.status(200).json({ success: true, data: clientDetail });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices/ops/:id/note  (staff)
 * POST /api/invoices/customer/:id/note  (customer — own invoice only)
 *
 * Shared note-append handler. When called from the customer route, we
 * enforce ownership. The `role` field on the note is derived from the
 * authenticated user's role — not trusted from the request body.
 */
export const addOpsInvoiceNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { body: noteBody } = req.body;
    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.userId;
    const actorRole = authReq.user?.role || "CUSTOMER";

    if (!noteBody || typeof noteBody !== "string" || noteBody.trim().length === 0) {
      throw new AppError("Note body cannot be empty.", 400);
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError("Invoice not found.", 404);

    // Ownership check: customers can only add notes to their own invoices
    if (actorRole === "CUSTOMER" && invoice.customerId.toString() !== actorId) {
      throw new AppError("Forbidden: you do not have access to this invoice", 403);
    }

    const currentNotes = invoice.extractedData?.notes || [];
    const newNote = {
      id: String(Date.now()),
      author: req.body.author || actorRole,
      role: actorRole,
      body: noteBody.trim(),
      time: new Date().toISOString(), // Store as ISO — format on frontend
    };

    invoice.extractedData = {
      ...(invoice.extractedData || {}),
      notes: [...currentNotes, newNote],
    };
    invoice.markModified("extractedData");
    await invoice.save();

    res.status(200).json({ success: true, message: "Note added successfully", data: newNote });
  } catch (error) {
    next(error);
  }
};

