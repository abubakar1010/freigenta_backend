import { Invoice } from "../../../shared/models/invoice.model";
import { User } from "../../../shared/models/user.model";
import { AuditLog } from "../../../shared/models/audit.model";

export class OpsOverviewService {
  async getOverviewMetrics() {
    // 1. Fetch Stats Counters
    const [
      activeCount,
      processingCount,
      approvedTodayCount,
      failedCount,
      kycPendingCount,
      manualReviewCount,
      totalDocsCount
    ] = await Promise.all([
      Invoice.countDocuments({ status: { $nin: ["COMPLETED", "REJECTED", "CANCELLED"] } }),
      Invoice.countDocuments({ status: { $in: ["UPLOADED", "PROCESSING", "MANUAL_REVIEW", "QUOTE_READY", "AWAITING_PAYMENT", "SETTLING"] } }),
      Invoice.countDocuments({
        status: "COMPLETED",
        updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }),
      Invoice.countDocuments({ status: { $in: ["REJECTED", "CANCELLED"] } }),
      User.countDocuments({ identityVerificationStatus: { $in: ["PENDING", "MANUAL_REVIEW"] } }),
      Invoice.countDocuments({ status: "MANUAL_REVIEW" }),
      Invoice.countDocuments({})
    ]);

    // 2. Compute Pipeline Stages count & amounts
    // Stages: Received, Verification, Quote Issued, Awaiting Payment, Settling, Completed
    const invoices = await Invoice.find({});
    
    const pipelineData = {
      received: { count: 0, amount: 0 },
      verification: { count: 0, amount: 0 },
      "quote-issued": { count: 0, amount: 0 },
      "awaiting-payment": { count: 0, amount: 0 },
      settling: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
    };

    invoices.forEach(inv => {
      const amt = inv.amount || 0;
      switch (inv.status) {
        case "UPLOADED":
        case "PROCESSING":
          pipelineData.received.count += 1;
          pipelineData.received.amount += amt;
          break;
        case "MANUAL_REVIEW":
          pipelineData.verification.count += 1;
          pipelineData.verification.amount += amt;
          break;
        case "QUOTE_READY":
          pipelineData["quote-issued"].count += 1;
          pipelineData["quote-issued"].amount += amt;
          break;
        case "AWAITING_PAYMENT":
          pipelineData["awaiting-payment"].count += 1;
          pipelineData["awaiting-payment"].amount += amt;
          break;
        case "SETTLING":
          pipelineData.settling.count += 1;
          pipelineData.settling.amount += amt;
          break;
        case "COMPLETED":
          pipelineData.completed.count += 1;
          pipelineData.completed.amount += amt;
          break;
      }
    });

    const pipelineStages = [
      { id: "received", label: "Received", count: pipelineData.received.count, amount: `$${pipelineData.received.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { id: "verification", label: "Verification", count: pipelineData.verification.count, amount: `$${pipelineData.verification.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { id: "quote-issued", label: "Quote Issued", count: pipelineData["quote-issued"].count, amount: `$${pipelineData["quote-issued"].amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { id: "awaiting-payment", label: "Awaiting Payment", count: pipelineData["awaiting-payment"].count, amount: `$${pipelineData["awaiting-payment"].amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { id: "settling", label: "Settling", count: pipelineData.settling.count, amount: `$${pipelineData.settling.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      { id: "completed", label: "Completed", count: pipelineData.completed.count, amount: `$${pipelineData.completed.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    ];

    // 3. Action Items list
    const actionItems = [
      { id: "kyc", label: "KYC Pending Review", count: kycPendingCount },
      { id: "payments-holds", label: "Payments Holds", count: manualReviewCount },
      { id: "documents", label: "Documents", count: totalDocsCount },
      { id: "client-feedback", label: "Client Feedback", count: 0 },
    ];

    // 4. Fetch last 5 invoices
    const rawInvoices = await Invoice.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customerId", "firstName lastName companyInfo.companyName");

    const invoicesList = rawInvoices.map(inv => {
      const customer = inv.customerId as any;
      const clientName = customer ? (customer.companyInfo?.companyName || `${customer.firstName} ${customer.lastName}`) : "Unknown Customer";
      
      let color: "blue" | "purple" | "amber" | "green" = "blue";
      let displayStage = "Verification";
      
      switch (inv.status) {
        case "UPLOADED":
        case "PROCESSING":
          color = "blue";
          displayStage = "Received";
          break;
        case "MANUAL_REVIEW":
          color = "blue";
          displayStage = "Verification";
          break;
        case "QUOTE_READY":
          color = "purple";
          displayStage = "Quote Issued";
          break;
        case "AWAITING_PAYMENT":
          color = "amber";
          displayStage = "Awaiting Payment";
          break;
        case "SETTLING":
          color = "purple";
          displayStage = "Settling";
          break;
        case "COMPLETED":
          color = "green";
          displayStage = "Completed";
          break;
        default:
          color = "blue";
          displayStage = inv.status;
      }

      return {
        id: inv._id.toString(),
        invoiceNo: inv.invoiceNo,
        shipment: `Client: ${clientName}`,
        carrier: inv.carrier,
        route: "Import Rail Rail Payout",
        etd: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A",
        amount: `$${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        currency: inv.currency,
        stage: displayStage,
        stageDetail: inv.status,
        stageColor: color
      };
    });

    // 5. Fetch logs as Alerts
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    const alertsList = logs.map(log => {
      const timeStr = log.createdAt ? new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : "N/A";
      return {
        id: log._id.toString(),
        title: log.event || "Activity logged",
        time: timeStr,
        dotColor: "#9CA3AF"
      };
    });

    // Default seed logs if empty
    if (alertsList.length === 0) {
      alertsList.push(
        { id: "d1", title: "Compliance portal synchronized successfully", time: "09:00 AM", dotColor: "#3B82F6" },
        { id: "d2", title: "Global settlement gateways verified", time: "11:30 AM", dotColor: "#10B981" }
      );
    }

    return {
      stats: {
        activeOrders: activeCount,
        inProcessing: processingCount,
        approvedToday: approvedTodayCount,
        failed: failedCount
      },
      pipelineStages,
      actionItems,
      invoices: invoicesList,
      alerts: alertsList
    };
  }
}
