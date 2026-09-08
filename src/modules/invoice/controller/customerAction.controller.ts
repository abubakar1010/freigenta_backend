import { Request, Response, NextFunction } from "express";
import { Invoice } from "../../../shared/models/invoice.model";
import { Quote } from "../../../shared/models/quote.model";
import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { AuditLog } from "../../../shared/models/audit.model";
import { logAudit } from "../../../shared/utils/audit";
import { AppError } from "../../../shared/utils/AppError";

export const getCustomerActionRequired = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;

    // Actions items are invoices in state of MANUAL_REVIEW (which maps to Flag/Action Required), 
    // or QUOTE_READY (Accept Quote action), or UPLOADED (Needs verification status), or AWAITING_PAYMENT (Make payment)
    const invoices = await Invoice.find({
      customerId: userId,
      status: { $in: ["MANUAL_REVIEW", "QUOTE_READY", "UPLOADED", "AWAITING_PAYMENT", "REJECTED"] }
    }).sort({ updatedAt: -1 });

    const actionItems = await Promise.all(invoices.map(async (inv) => {
      // Set properties based on status
      let actionTitle = "Upload Docs";
      let actionSubtitle = "Document not verified";
      let actionColor = "bg-[#3B82F6]";
      let deadline = inv.invoiceDueDate ? new Date(inv.invoiceDueDate).toLocaleDateString("en-GB") : "25 Jul 2026";

      if (inv.status === "UPLOADED") {
        actionTitle = "Verification Pending";
        actionSubtitle = "Under OCR review";
        actionColor = "bg-[#3B82F6]";
      } else if (inv.status === "MANUAL_REVIEW" || inv.status === "REJECTED") {
        actionTitle = "Resubmit Docs";
        actionSubtitle = inv.extractedData?.rejectionReason || "File missing / verification failed";
        actionColor = "bg-[#EF4444]";
      } else if (inv.status === "QUOTE_READY") {
        actionTitle = "Accept Quote";
        actionSubtitle = `$ ${inv.amount.toLocaleString()} USD • Rate confirmation required`;
        actionColor = "bg-[#8B5CF6]";
      } else if (inv.status === "AWAITING_PAYMENT") {
        actionTitle = "Make Payment";
        const quote = await Quote.findOne({ invoiceId: inv._id });
        const payableAmount = quote ? quote.amountPayable : (inv.amount * 1600);
        actionSubtitle = `₦ ${payableAmount.toLocaleString()} NGN equivalent due`;
        actionColor = "bg-[#F59E0B]";
      }

      const routeFrom = inv.extractedData?.routeFrom || "Hamburg";
      const routeTo = inv.extractedData?.routeTo || "Lagos";

      // Fetch audit logs for this specific invoice to populate drawer history
      const audits = await AuditLog.find({ relatedRecordId: inv._id.toString() }).sort({ createdAt: -1 });
      const history = audits.map((audit) => {
        let title = audit.event.replace(/_/g, ' ');
        // Humanize the event timing
        const timeString = audit.createdAt ? new Date(audit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now";
        return {
          title,
          time: timeString
        };
      });

      // Default fallback history if empty
      if (history.length === 0) {
        history.push(
          { title: "Submitted", time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now" }
        );
      }

      return {
        id: inv._id.toString(),
        invoice: inv.invoiceNo,
        shipment: inv.extractedData?.shipmentNo || `SHP-${inv.invoiceNo.split("-")[1] || "000"}`,
        actionTitle,
        actionSubtitle,
        actionColor,
        route: `${routeFrom} → ${routeTo}`,
        routeDate: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Pending",
        deadline,
        amount: `$ ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${inv.currency}`,
        carrier: inv.carrier,
        status: inv.status === "MANUAL_REVIEW" ? "Flag" : inv.status === "REJECTED" ? "Flag" : inv.status,
        history
      };
    }));

    res.status(200).json({
      success: true,
      data: actionItems
    });
  } catch (error) {
    next(error);
  }
};

export const submitCustomerActionResubmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found.", 404);
    }

    if (invoice.customerId.toString() !== userId) {
      throw new AppError("Forbidden access: Insufficient permissions", 403);
    }

    // Change status back to UPLOADED/PROCESSING after user uploads corrective documents
    invoice.status = "PROCESSING";
    if (invoice.extractedData) {
      invoice.extractedData.rejectionReason = undefined;
    }
    await invoice.save();

    await logAudit(
      userId,
      "INVOICE_RESUBMITTED",
      invoice._id.toString(),
      undefined,
      { status: invoice.status },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: "Invoice resubmitted for processing successfully",
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

export const submitCustomerActionCancel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found.", 404);
    }

    if (invoice.customerId.toString() !== userId) {
      throw new AppError("Forbidden access: Insufficient permissions", 403);
    }

    invoice.status = "CANCELLED";
    await invoice.save();

    await logAudit(
      userId,
      "INVOICE_CANCELLED",
      invoice._id.toString(),
      undefined,
      { status: invoice.status },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: "Invoice request cancelled successfully",
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};
