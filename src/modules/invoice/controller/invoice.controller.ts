import { Request, Response, NextFunction } from "express";
import { Invoice } from "../../../shared/models/invoice.model";
import { User } from "../../../shared/models/user.model";
import { S3Service } from "../../../shared/services/s3.service";
import { logAudit } from "../../../shared/utils/audit";
import { AppError } from "../../../shared/utils/AppError";
import fileUpload from "express-fileupload";

const s3Service = new S3Service();

export const uploadInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      throw new AppError("Unauthorized access", 401);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Verify customer identity is complete before allowing invoice upload (Section 4.5 requirement)
    // Dynamic bypass allowed only in non-production local development testing environments
    const isProd = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod";
    if (isProd && user.identityVerificationStatus !== "VERIFIED") {
      throw new AppError("You must verify your identity (BVN/NIN) before uploading freight invoices.", 403);
    }

    // Parse body inputs from UploadInvoiceForm
    const {
      invoiceDate,
      payer,
      invoiceNo,
      contractPoNumber,
      currency,
      originPort,
      invoiceAmount,
      destinationPort,
      paymentTerms,
      destinationDetails,
      invoiceDueDate,
    } = req.body;

    if (!invoiceNo) {
      throw new AppError("Invoice number is required.", 400);
    }
    if (!payer) {
      throw new AppError("Payer (carrier) is required.", 400);
    }
    if (!invoiceAmount || isNaN(Number(invoiceAmount))) {
      throw new AppError("Valid invoice amount is required.", 400);
    }

    // Check uniqueness of invoiceNo
    const existing = await Invoice.findOne({ invoiceNo });
    if (existing) {
      throw new AppError(`Invoice with number ${invoiceNo} already exists.`, 409);
    }

    // Handle files upload
    if (!req.files || !req.files.file) {
      throw new AppError("Invoice document file is required.", 400);
    }

    const file = req.files.file as fileUpload.UploadedFile;

    // Save document file securely via MinioService
    const fileUrl = await s3Service.uploadFile(file.name, file.data, file.mimetype);

    // Save metadata of optional files if present
    const documentsList: any[] = [
      { type: "Commercial Invoice", name: file.name, url: fileUrl, size: file.size }
    ];

    // Optional supporting documents
    const docKeys = ["billOfLading", "packingList", "certificateOfOrigin", "exportLicense", "otherDocuments"];
    for (const key of docKeys) {
      if (req.files[key]) {
        const docFile = req.files[key] as fileUpload.UploadedFile;
        const url = await s3Service.uploadFile(docFile.name, docFile.data, docFile.mimetype);
        documentsList.push({
          type: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          name: docFile.name,
          url,
          size: docFile.size
        });
      }
    }

    const amount = Number(invoiceAmount);
    const dateParsed = invoiceDate ? new Date(invoiceDate) : new Date();
    const dueDateParsed = invoiceDueDate ? new Date(invoiceDueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const invoice = await Invoice.create({
      invoiceNo,
      customerId: userId,
      carrier: payer,
      invoiceDate: isNaN(dateParsed.getTime()) ? new Date() : dateParsed,
      invoiceDueDate: isNaN(dueDateParsed.getTime()) ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : dueDateParsed,
      currency: currency || "USD",
      amount,
      fileUrl,
      status: "UPLOADED",
      ocrConfidence: 100,
      extractedData: {
        carrier: payer,
        invoiceNo,
        amount,
        currency: currency || "USD",
        contractPoNumber: contractPoNumber || "",
        originPort: originPort || "",
        destinationPort: destinationPort || "",
        paymentTerms: paymentTerms || "",
        destinationDetails: destinationDetails || "",
        documents: documentsList
      },
    });

    // Log the audit event (Section 23 requirements)
    await logAudit(
      userId,
      "INVOICE_UPLOADED",
      invoice._id.toString(),
      undefined,
      { invoiceNo, carrier: payer, amount },
      req.ip
    );

    res.status(201).json({
      success: true,
      message: "Invoice uploaded and processed successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const invoices = await Invoice.find({ customerId: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
};

export const getOpsInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const total = await Invoice.countDocuments();
    const invoices = await Invoice.find()
      .populate("customerId", "firstName lastName emailAddress companyInfo")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

export const correctInvoiceData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const opsUserId = (req as any).user?.id || (req as any).user?.userId;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    const previousValues = {
      carrier: invoice.carrier,
      invoiceNo: invoice.invoiceNo,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
    };

    // Apply allowed updates
    if (updates.carrier) invoice.carrier = updates.carrier;
    if (updates.invoiceNo) invoice.invoiceNo = updates.invoiceNo;
    if (updates.amount) invoice.amount = updates.amount;
    if (updates.currency) invoice.currency = updates.currency;
    if (updates.status) invoice.status = updates.status;

    await invoice.save();

    // Log the manual change audit event (Section 8 & 23 requirements)
    await logAudit(
      opsUserId,
      "INVOICE_DATA_CORRECTED",
      invoice._id.toString(),
      previousValues,
      {
        carrier: invoice.carrier,
        invoiceNo: invoice.invoiceNo,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
      },
      req.ip
    );

    res.status(200).json({
      success: true,
      message: "Invoice data corrected and logged successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};



