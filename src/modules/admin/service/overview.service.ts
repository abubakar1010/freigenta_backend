import { Invoice } from "../../../shared/models/invoice.model";
import { User } from "../../../shared/models/user.model";
import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { AuditLog } from "../../../shared/models/audit.model";
import { Types } from "mongoose";

const getRelativeTime = (date?: Date) => {
  if (!date) return "Just now";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export class AdminOverviewService {
  async getOverviewData(search: string) {
    // 1. Calculate Metrics
    const invoices = await Invoice.find({});
    
    // Filter non-cancelled/rejected invoices for total volume
    const validInvoices = invoices.filter(
      (inv) => !["REJECTED", "CANCELLED"].includes(inv.status)
    );

    const totalVolume30d = validInvoices
      .filter(
        (inv) =>
          inv.createdAt &&
          Date.now() - new Date(inv.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000
      )
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    let totalVolume30dStr = "$0.00";
    if (totalVolume30d >= 1000000) {
      totalVolume30dStr = `$${(totalVolume30d / 1000000).toFixed(2)}M`;
    } else if (totalVolume30d >= 1000) {
      totalVolume30dStr = `$${(totalVolume30d / 1000).toFixed(2)}K`;
    } else {
      totalVolume30dStr = `$${totalVolume30d.toFixed(2)}`;
    }

    const customerUsersCount = await User.countDocuments({
      role: { $regex: /^customer$/i },
    });
    
    const nonAdminUsersCount = await User.countDocuments({
      role: { $not: { $regex: /^(admin|ops|compliance|treasury)$/i } },
    });

    const totalUsersCount = await User.countDocuments({});

    const activeUsersCount = customerUsersCount > 0 
      ? customerUsersCount 
      : (nonAdminUsersCount > 0 ? nonAdminUsersCount : totalUsersCount);

    const totalTransactionsCount = await PaymentOrder.countDocuments({});
    const completedTransactionsCount = await PaymentOrder.countDocuments({
      status: "COMPLETED",
    });

    let reconciliationRate = 0;
    if (totalTransactionsCount > 0) {
      reconciliationRate = (completedTransactionsCount / totalTransactionsCount) * 100;
    } else if (invoices.length > 0) {
      const completedInvoices = invoices.filter((i) => i.status === "COMPLETED").length;
      reconciliationRate = (completedInvoices / invoices.length) * 100;
    }

    const totalLiquidityAmount = validInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    let totalLiquidityStr = "$0.00";
    if (totalLiquidityAmount >= 1000000) {
      totalLiquidityStr = `$${(totalLiquidityAmount / 1000000).toFixed(2)}M`;
    } else if (totalLiquidityAmount >= 1000) {
      totalLiquidityStr = `$${(totalLiquidityAmount / 1000).toFixed(2)}K`;
    } else {
      totalLiquidityStr = `$${totalLiquidityAmount.toFixed(2)}`;
    }

    const metrics = [
      {
        id: "volume",
        title: "Total Volume (30d)",
        value: totalVolume30dStr,
        subtext: "From invoices in last 30d",
      },
      {
        id: "users",
        title: "Active Users",
        value: activeUsersCount.toLocaleString(),
        subtext: "Registered customers",
      },
      {
        id: "reconciliation",
        title: "Reconciliation Rate",
        value: `${reconciliationRate.toFixed(1)}%`,
        subtext: "Settled vs Total txs",
      },
      {
        id: "liquidity",
        title: "Total Liquidity",
        value: totalLiquidityStr,
        subtext: "Cumulative invoice sum",
      },
    ];

    // 2. Monthly Chart Data (Last 6 Months)
    const chartData = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();

      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const monthInvoices = invoices.filter(
        (inv) =>
          inv.createdAt &&
          new Date(inv.createdAt) >= startOfMonth &&
          new Date(inv.createdAt) <= endOfMonth
      );

      const approvedCount = monthInvoices.filter((inv) => inv.status === "COMPLETED").length;
      const failedCount = monthInvoices.filter((inv) =>
        ["REJECTED", "CANCELLED"].includes(inv.status)
      ).length;

      chartData.push({
        month: monthNames[month],
        approved: approvedCount,
        failed: failedCount,
      });
    }

    // Scale to 0-100 range for frontend bar chart rendering
    let maxCount = 1;
    chartData.forEach((c) => {
      if (c.approved > maxCount) maxCount = c.approved;
      if (c.failed > maxCount) maxCount = c.failed;
    });

    const scaledChartData = chartData.map((c) => ({
      month: c.month,
      approved: maxCount > 1 ? Math.round((c.approved / maxCount) * 80) : c.approved > 0 ? 50 : 0,
      failed: maxCount > 1 ? Math.round((c.failed / maxCount) * 80) : c.failed > 0 ? 50 : 0,
    }));

    // 3. Recent Activity (Audit logs)
    const auditLogs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("actorId", "firstName lastName");

    const recentActivity = auditLogs.map((log) => {
      const actor = log.actorId as any;
      const userName = actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() : "System";
      const customDescription = (log as any).description || `Event recorded: ${(log.event || "").replace(/_/g, " ")}`;
      return {
        id: log._id.toString(),
        action: log.event || "Activity Logged",
        description: customDescription,
        user: userName || "System",
        time: getRelativeTime(log.createdAt),
      };
    });

    // 4. Recent Transactions with comprehensive multi-field search
    const txQuery: any = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");

      // Find matching users first
      const matchingUsers = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { "companyInfo.legalCompanyName": searchRegex },
          { "companyInfo.tradingName": searchRegex },
          { "companyInfo.companyName": searchRegex },
        ],
      }).select("_id");

      const matchingUserIds = matchingUsers.map((u) => u._id);

      const orConditions: any[] = [
        { invoiceNo: searchRegex },
        { carrier: searchRegex },
        { status: searchRegex },
        { "extractedData.routeFrom": searchRegex },
        { "extractedData.routeTo": searchRegex },
        { "extractedData.origin": searchRegex },
        { "extractedData.destination": searchRegex },
      ];

      if (matchingUserIds.length > 0) {
        orConditions.push({ customerId: { $in: matchingUserIds } });
      }

      if (Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: new Types.ObjectId(search) });
      }

      txQuery.$or = orConditions;
    }

    const recentInvoices = await Invoice.find(txQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customerId", "firstName lastName companyInfo");

    const recentTransactions = recentInvoices.map((inv) => {
      const customer = inv.customerId as any;
      const customerName =
        customer?.companyInfo?.legalCompanyName ||
        customer?.companyInfo?.tradingName ||
        customer?.companyInfo?.companyName ||
        (customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() : "") ||
        "Unknown Customer";

      let uiStatus: "Approved" | "Processing" | "Pending" | "Failed" = "Pending";
      if (inv.status === "COMPLETED") {
        uiStatus = "Approved";
      } else if (["PROCESSING", "SETTLING", "QUOTE_READY", "AWAITING_PAYMENT"].includes(inv.status)) {
        uiStatus = "Processing";
      } else if (["UPLOADED", "MANUAL_REVIEW"].includes(inv.status)) {
        uiStatus = "Pending";
      } else if (["REJECTED", "CANCELLED"].includes(inv.status)) {
        uiStatus = "Failed";
      }

      const from = inv.extractedData?.routeFrom || inv.extractedData?.origin || "Hamburg";
      const to = inv.extractedData?.routeTo || inv.extractedData?.destination || "Lagos";

      return {
        id: `PAY-${inv._id.toString().slice(-6).toUpperCase()}`,
        invoice: inv.invoiceNo,
        customerName,
        carrier: inv.carrier || "N/A",
        from,
        to,
        amount: inv.amount || 0,
        status: uiStatus,
      };
    });

    return {
      metrics,
      chartData: scaledChartData,
      recentActivity,
      recentTransactions,
    };
  }
}

