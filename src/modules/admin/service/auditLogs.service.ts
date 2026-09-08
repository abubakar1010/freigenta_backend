import { AuditLog } from "../../../shared/models/audit.model";
import { User } from "../../../shared/models/user.model";
import { Invoice } from "../../../shared/models/invoice.model";

export class AdminAuditLogsService {
  private mapToAuditLogDto(log: any) {
    const actor = log.actorId || {};
    const actorName =
      actor.firstName && actor.lastName
        ? `${actor.firstName} ${actor.lastName}`
        : "System Operations";

    // Map role type: Admin or OPS Manager
    const role: "Admin" | "OPS Manager" =
      (actor.role || "").toUpperCase() === "ADMIN" ? "Admin" : "OPS Manager";

    // Clean up event name to make it user friendly (e.g., INVOICE_UPLOADED -> Invoice Uploaded)
    const action = (log.event || "System Action")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    // Format date and time (e.g., 15 May 2026 09:30 AM)
    const rawDate = log.createdAt || new Date();
    const dateTime = new Date(rawDate)
      .toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/,/g, "");

    // Determine status based on event type
    const status: "Completed" | "Flagged" = [
      "REJECTED",
      "CANCELLED",
      "FAILED",
    ].some((s) => log.event?.includes(s))
      ? "Flagged"
      : "Completed";

    // Lookup company metadata if available in values or defaults
    const relatedCompany =
      log.newValue?.carrier ||
      log.newValue?.companyInfo?.legalCompanyName ||
      log.previousValue?.carrier ||
      "Adesola Cicero";

    return {
      id: `AUD-${log._id.toString().slice(-4).toUpperCase()}`,
      dbId: log._id.toString(),
      dateTime,
      relatedCompany,
      user: actorName,
      role,
      action,
      status,
    };
  }

  private async ensureSeedData() {
    const count = await AuditLog.countDocuments({});
    if (count > 0) return;

    // Find any user to act as actor
    const user = await User.findOne({});
    if (!user) return;

    const invoices = await Invoice.find({}).limit(5);

    // Create a few mock audit entries linked to actual database entries
    const events = [
      {
        event: "INVOICE_UPLOADED",
        company: invoices[0]?.carrier || "Maersk Line",
      },
      {
        event: "QUOTE_GENERATED",
        company: invoices[1]?.carrier || "Hapag-Lloyd",
      },
      { event: "USER_LOGIN", company: "System Portal" },
      { event: "INVOICE_REJECTED", company: invoices[2]?.carrier || "CMA CGM" },
    ];

    for (let i = 0; i < events.length; i++) {
      await AuditLog.create({
        actorId: user._id,
        event: events[i].event,
        newValue: { carrier: events[i].company },
      });
    }
  }

  async getAuditLogs(params: { page: number; limit: number }) {
    await this.ensureSeedData();

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 10);

    const total = await AuditLog.countDocuments({});
    const dbLogs = await AuditLog.find({})
      .populate("actorId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const logs = dbLogs.map((log) => this.mapToAuditLogDto(log));

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
