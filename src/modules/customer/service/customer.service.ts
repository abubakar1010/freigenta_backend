import { Invoice } from "../../../shared/models/invoice.model";
import { PaymentMethod } from "../models/payment-method.model";
import { AppError } from "../../../shared/utils/AppError";
import { AuditLog } from "../../../shared/models/audit.model";

// ─── Shared pipeline config ────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: "draft", label: "Draft", status: "draft", statuses: ["UPLOADED"] },
  {
    id: "verification",
    label: "Verification",
    status: "verification",
    statuses: ["PROCESSING", "MANUAL_REVIEW"],
  },
  {
    id: "quote",
    label: "Quote Generated",
    status: "quote",
    statuses: ["QUOTE_READY"],
  },
  {
    id: "awaiting",
    label: "Awaiting Payment",
    status: "awaiting",
    statuses: ["AWAITING_PAYMENT"],
  },
  {
    id: "settling",
    label: "Settling",
    status: "settling",
    statuses: ["SETTLING"],
  },
  {
    id: "completed",
    label: "Completed",
    status: "completed",
    statuses: ["COMPLETED"],
  },
];

type StageStatus = "review" | "quote" | "awaiting" | "settling" | "completed";
type ProgressState = "check" | "cross" | "hollow";

interface MappedStage {
  stageTitle: string;
  stageSubtitle: string;
  stageStatus: StageStatus;
  progressStep: number;
  stageColorHex: string;
  progressState: ProgressState;
  progressColorClass: string;
}

function mapInvoiceStatus(status: string): MappedStage {
  switch (status) {
    case "UPLOADED":
      return {
        stageTitle: "Draft",
        stageSubtitle: "Awaiting review",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#6B7280",
        progressState: "hollow",
        progressColorClass: "bg-[#9CA3AF]",
      };
    case "PROCESSING":
      return {
        stageTitle: "Verification",
        stageSubtitle: "Under OCR review",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#6B7280",
        progressState: "check",
        progressColorClass: "bg-[#9CA3AF]",
      };
    case "MANUAL_REVIEW":
      return {
        stageTitle: "Verification",
        stageSubtitle: "Under manual review",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#6B7280",
        progressState: "check",
        progressColorClass: "bg-[#9CA3AF]",
      };
    case "QUOTE_READY":
      return {
        stageTitle: "Quote Generated",
        stageSubtitle: "Awaiting acceptance",
        stageStatus: "quote",
        progressStep: 2,
        stageColorHex: "#3B82F6",
        progressState: "check",
        progressColorClass: "bg-[#60A5FA]",
      };
    case "AWAITING_PAYMENT":
      return {
        stageTitle: "Awaiting Payment",
        stageSubtitle: "Pay NGN equivalent",
        stageStatus: "awaiting",
        progressStep: 3,
        stageColorHex: "#F59E0B",
        progressState: "check",
        progressColorClass: "bg-[#FBBF24]",
      };
    case "SETTLING":
      return {
        stageTitle: "Settling",
        stageSubtitle: "Sending to Carrier",
        stageStatus: "settling",
        progressStep: 4,
        stageColorHex: "#8B5CF6",
        progressState: "check",
        progressColorClass: "bg-[#A78BFA]",
      };
    case "COMPLETED":
      return {
        stageTitle: "Completed",
        stageSubtitle: "Settled and paid",
        stageStatus: "completed",
        progressStep: 5,
        stageColorHex: "#10B981",
        progressState: "check",
        progressColorClass: "bg-[#34D399]",
      };
    case "REJECTED":
      return {
        stageTitle: "Flag",
        stageSubtitle: "Invoice rejected",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#EF4444",
        progressState: "cross",
        progressColorClass: "bg-[#F87171]",
      };
    case "CANCELLED":
      return {
        stageTitle: "Cancelled",
        stageSubtitle: "Request cancelled",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#6B7280",
        progressState: "cross",
        progressColorClass: "bg-[#9CA3AF]",
      };
    default:
      return {
        stageTitle: "Verification",
        stageSubtitle: "Under review",
        stageStatus: "review",
        progressStep: 1,
        stageColorHex: "#6B7280",
        progressState: "check",
        progressColorClass: "bg-[#9CA3AF]",
      };
  }
}

function formatPaymentRecord(inv: any) {
  const mapped = mapInvoiceStatus(inv.status);
  const fallbackShipment = `SHP-${inv.invoiceNo?.split("-")[1] || "000"}`;

  const routeFrom = inv.extractedData?.routeFrom || "Hamburg";
  const routeTo = inv.extractedData?.routeTo || "Lagos";

  return {
    id: inv._id.toString(),
    invoice: inv.invoiceNo,
    shipment: inv.extractedData?.shipmentNo || fallbackShipment,
    carrier: inv.carrier,
    carrierDetail: inv.extractedData?.carrierVia || "Ocean Freight",
    route: `${routeFrom} → ${routeTo}`,
    etd: inv.invoiceDueDate
      ? new Date(inv.invoiceDueDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Pending",
    amount: `$ ${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    currency: inv.currency,
    stage: mapped.stageTitle,
    stageSubtitle: mapped.stageSubtitle,
    stageColorHex: mapped.stageColorHex,
    destinationProgress: mapped.progressStep,
    progressState: mapped.progressState,
    progressColorClass: mapped.progressColorClass,
  };
}

export class CustomerService {
  async getDashboardData(userId: string, startDate?: string, endDate?: string) {
    const queryFilter: any = { customerId: userId };

    if (startDate || endDate) {
      queryFilter.createdAt = {};
      if (startDate) {
        queryFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryFilter.createdAt.$lte = end;
      }
    }

    const invoices = await Invoice.find(queryFilter).sort({ createdAt: -1 });

    const activeCount = invoices.filter(
      (inv) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(inv.status),
    ).length;
    const processingCount = invoices.filter((inv) =>
      ["PROCESSING", "MANUAL_REVIEW"].includes(inv.status),
    ).length;
    const approvedCount = invoices.filter((inv) =>
      ["QUOTE_READY", "COMPLETED"].includes(inv.status),
    ).length;
    const failedCount = invoices.filter(
      (inv) => inv.status === "REJECTED",
    ).length;

    const metrics = [
      {
        id: "active",
        title: "Your active orders",
        value: activeCount,
        subtitle: `${failedCount} flagged`,
        isAlert: false,
      },
      {
        id: "processing",
        title: "In processing",
        value: processingCount,
        subtitle: "vs last month",
        isAlert: false,
      },
      {
        id: "approved",
        title: "Approved today",
        value: approvedCount,
        subtitle: "Across accounts",
        isAlert: false,
      },
      {
        id: "failed",
        title: "Failed",
        value: failedCount,
        subtitle: "Across banks",
        isAlert: failedCount > 0,
      },
    ];

    const pipeline = PIPELINE_STAGES.map((stage) => {
      const stageInvoices = invoices.filter((inv) =>
        stage.statuses.includes(inv.status),
      );
      const totalAmount = stageInvoices.reduce(
        (sum, inv) => sum + inv.amount,
        0,
      );
      return {
        id: stage.id,
        label: stage.label,
        count: stageInvoices.length,
        amountFormatted: `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        status: stage.status,
      };
    });

    const payments = invoices.slice(0, 20).map(formatPaymentRecord);

    return { metrics, pipeline, payments };
  }

  async getPayments(userId: string, page: number, limit: number, search: string, stage: string, sortBy: string, sortOrder: 1 | -1) {
    const query: any = { customerId: userId };

    if (stage) {
      const stageMap: Record<string, string[]> = {
        DRAFT: ["UPLOADED"],
        VERIFICATION: ["PROCESSING", "MANUAL_REVIEW"],
        QUOTE_GENERATED: ["QUOTE_READY"],
        AWAITING_PAYMENT: ["AWAITING_PAYMENT"],
        SETTLING: ["SETTLING"],
        COMPLETED: ["COMPLETED"],
        FLAG: ["REJECTED"],
      };
      const dbStatuses = stageMap[stage];
      if (dbStatuses) query.status = { $in: dbStatuses };
    }

    if (search) {
      query.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { carrier: { $regex: search, $options: "i" } },
      ];
    }

    const SORTABLE = new Set([
      "createdAt",
      "amount",
      "invoiceNo",
      "invoiceDueDate",
    ]);
    const sort: any = {
      [SORTABLE.has(sortBy) ? sortBy : "createdAt"]: sortOrder,
    };

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return {
      payments: invoices.map(formatPaymentRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(userId: string, id: string) {
    const invoice = await Invoice.findOne({
      _id: id,
      customerId: userId,
    });
    if (!invoice) throw new AppError("Payment not found.", 404);

    return formatPaymentRecord(invoice);
  }

  async getCurrencies() {
    try {
      const redisClient = require("../../../shared/database/redis").getRedisClient();
      if (redisClient) {
        const cached = await redisClient.get("currencies");
        if (cached) {
          return JSON.parse(cached);
        }
      }

      const fetchRes = await fetch("https://restcountries.com/v3.1/all");
      const data = (await fetchRes.json()) as any[];

      const uniqueCurrencies = new Set<string>();
      uniqueCurrencies.add("USD");
      data.forEach((country) => {
        if (country.currencies) {
          Object.keys(country.currencies).forEach((code) => {
            if (code && code.length === 3) {
              uniqueCurrencies.add(code.toUpperCase());
            }
          });
        }
      });

      const result = Array.from(uniqueCurrencies).sort((a, b) => {
        if (a === "USD") return -1;
        if (b === "USD") return 1;
        return a.localeCompare(b);
      });

      if (redisClient) {
        await redisClient.set("currencies", JSON.stringify(result), "EX", 24 * 60 * 60);
      }
      return result;
    } catch (error: any) {
      console.warn(
        "[getCurrencies Fallback]: Failed to fetch countries API",
        error.message,
      );
      const fallbackList = [
        "USD", "EUR", "GBP", "NGN", "CAD", "AUD", "CNY", "JPY", "INR", "CHF", "AED", "SAR", "ZAR",
        "SGD", "HKD", "NZD", "KRW", "SEK", "NOK", "DKK", "MXN", "BRL", "RUB", "TRY", "IDR", 
        "MYR", "PHP", "THB", "VND", "PKR", "BDT", "EGP", "KES", "GHS", "UGX", "RWF", "MAD"
      ];
      return Array.from(new Set(fallbackList)).sort((a, b) => {
        if (a === "USD") return -1;
        if (b === "USD") return 1;
        return a.localeCompare(b);
      });
    }
  }

  async getReportsData(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const invoices = await Invoice.find({ customerId: userId });
    const settledThisMonthInvoices = invoices.filter(
      (inv) =>
        inv.status === "COMPLETED" &&
        inv.updatedAt &&
        new Date(inv.updatedAt) >= startOfMonth,
    );
    const totalSettledAmount = settledThisMonthInvoices.reduce(
      (sum, inv) => sum + inv.amount,
      0,
    );

    let settledThisMonthStr = "$0.00";
    if (totalSettledAmount >= 1000000) {
      settledThisMonthStr = `$${(totalSettledAmount / 1000000).toFixed(2)}M`;
    } else if (totalSettledAmount >= 1000) {
      settledThisMonthStr = `$${(totalSettledAmount / 1000).toFixed(2)}K`;
    } else {
      settledThisMonthStr = `$${totalSettledAmount.toFixed(2)}`;
    }

    const completedInvoices = invoices.filter(
      (inv) => inv.status === "COMPLETED",
    );
    const onTimeInvoices = completedInvoices.filter(
      (inv) =>
        !inv.invoiceDueDate ||
        !inv.updatedAt ||
        new Date(inv.updatedAt) <= new Date(inv.invoiceDueDate),
    );
    const onTimePct =
      completedInvoices.length > 0
        ? (onTimeInvoices.length / completedInvoices.length) * 100
        : 0;

    const invoiceIds = invoices.map((inv) => inv._id.toString());
    const quoteLogs = await AuditLog.find({
      relatedRecordId: { $in: invoiceIds },
      event: "QUOTE_GENERATED",
    });

    const approvalDurations: number[] = [];
    for (const log of quoteLogs) {
      const inv = invoices.find(
        (i) => i._id.toString() === log.relatedRecordId,
      );
      if (inv && inv.createdAt && log.createdAt) {
        const duration =
          new Date(log.createdAt).getTime() -
          new Date(inv.createdAt).getTime();
        if (duration > 0) {
          approvalDurations.push(duration);
        }
      }
    }

    let medianApprovalStr = "0";
    if (approvalDurations.length > 0) {
      approvalDurations.sort((a, b) => a - b);
      const mid = Math.floor(approvalDurations.length / 2);
      const medianMs =
        approvalDurations.length % 2 !== 0
          ? approvalDurations[mid]
          : (approvalDurations[mid - 1] + approvalDurations[mid]) / 2;

      const totalSeconds = Math.floor(medianMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      medianApprovalStr =
        minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }

    const reports = [
      {
        id: "1",
        title: "Monthly settlement summary",
        subtitle: `${now.toLocaleString("en-US", { month: "long", year: "numeric" })} • CSV`,
      },
      {
        id: "2",
        title: "Compliance Report",
        subtitle: `${now.toLocaleString("en-US", { month: "long", year: "numeric" })} • CSV`,
      },
      {
        id: "3",
        title: "Treasury reconciliation",
        subtitle: `${now.toLocaleString("en-US", { month: "long", year: "numeric" })} • CSV`,
      },
      {
        id: "4",
        title: "Carrier spend by lane",
        subtitle: `${now.toLocaleString("en-US", { month: "long", year: "numeric" })} • CSV`,
      },
      {
        id: "5",
        title: "Approval cycle benchmark",
        subtitle: `${now.toLocaleString("en-US", { month: "long", year: "numeric" })} • CSV`,
      },
    ];

    return {
      settledThisMonth: settledThisMonthStr,
      onTimePayments: `${onTimePct.toFixed(1)}%`,
      medianApproval: medianApprovalStr,
      reports,
    };
  }

  async exportReportCsv(userId: string, id: string) {
    const invoices = await Invoice.find({ customerId: userId }).sort({
      createdAt: -1,
    });

    let csvContent = "";
    if (id === "1" || id === "3") {
      csvContent =
        "Invoice No,Carrier,Amount,Currency,Status,Created At,Due Date\n";
      invoices.forEach((inv) => {
        csvContent += `"${inv.invoiceNo}","${inv.carrier}",${inv.amount},"${inv.currency}","${inv.status}","${inv.createdAt ? new Date(inv.createdAt).toISOString() : ""}","${inv.invoiceDueDate ? new Date(inv.invoiceDueDate).toISOString() : ""}"\n`;
      });
    } else if (id === "2") {
      csvContent =
        "Invoice No,Carrier,Status,Identity Verified,Timeline Logs\n";
      invoices.forEach((inv) => {
        csvContent += `"${inv.invoiceNo}","${inv.carrier}","${inv.status}","Verified","${inv.extractedData?.rejectionReason || "None"}"\n`;
      });
    } else {
      csvContent = "Carrier,Total Invoices,Total Amount,Average Amount\n";
      const groups: Record<string, { count: number; total: number }> = {};
      invoices.forEach((inv) => {
        if (!groups[inv.carrier]) {
          groups[inv.carrier] = { count: 0, total: 0 };
        }
        groups[inv.carrier].count += 1;
        groups[inv.carrier].total += inv.amount;
      });
      Object.entries(groups).forEach(([carrier, stat]) => {
        csvContent += `"${carrier}",${stat.count},${stat.total},${(stat.total / stat.count).toFixed(2)}\n`;
      });
    }

    return csvContent;
  }

  async getPaymentMethods(userId: string) {
    return PaymentMethod.find({ customerId: userId }).sort({
      createdAt: -1,
    });
  }

  async addPaymentMethod(userId: string, body: any) {
    const { bankName, accountHolder, accountType, currency, accountNumber } = body;
    if (!bankName || !accountHolder || !accountNumber) {
      throw new AppError(
        "Bank name, account holder, and account number are required.",
        400,
      );
    }

    const initials = bankName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);

    const newMethod = new PaymentMethod({
      customerId: userId,
      bankName,
      accountHolder,
      accountType: accountType || "Current Account",
      currency: currency || "USD",
      accountNumber,
      initials,
    });

    await newMethod.save();
    return newMethod;
  }

  async deletePaymentMethod(userId: string, id: string) {
    const result = await PaymentMethod.findOneAndDelete({
      _id: id,
      customerId: userId,
    });
    if (!result) {
      throw new AppError("Payment method not found.", 404);
    }
    return result;
  }
}

