import { Invoice } from "../../../shared/models/invoice.model";
import { User } from "../../../shared/models/user.model";
import { PaymentOrder } from "../../../shared/models/paymentOrder.model";
import { AuditLog } from "../../../shared/models/audit.model";
import { AppError } from "../../../shared/utils/AppError";

export class OpsReportsService {
  async getReportsList() {
    return [
      {
        id: "operational",
        title: "Operational Report",
        description: "Review invoice volume throughput, carrier SLA distribution, and processing metrics.",
      },
      {
        id: "compliance",
        title: "Compliance Report",
        description: "Analyze customer identity checks, BVN/NIN verification states, and onboarding steps.",
      },
      {
        id: "risk",
        title: "Risk Summary",
        description: "Track cumulative transaction volumes, FX conversion amounts, and carrier settlement flags.",
      },
      {
        id: "audit",
        title: "Audit Export",
        description: "Export global event logs, system operations, and administrator audit trails.",
      },
    ];
  }

  async generateReportCsv(id: string): Promise<{ filename: string; csv: string }> {
    const timestamp = new Date().toISOString().slice(0, 10);
    let csv = "";
    let filename = `report_${id}_${timestamp}.csv`;

    switch (id) {
      case "operational": {
        const invoices = await Invoice.find({});
        const headers = ["Invoice ID", "Invoice Number", "Carrier", "Currency", "Amount", "Status", "Created Date"];
        const rows = invoices.map(i => [
          i._id.toString(),
          i.invoiceNo,
          i.carrier,
          i.currency,
          i.amount.toString(),
          i.status,
          i.createdAt ? new Date(i.createdAt).toISOString() : "N/A"
        ]);
        csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
        break;
      }
      case "compliance": {
        const users = await User.find({ role: { $regex: /^customer$/i } });
        const headers = ["User ID", "Full Name", "Email", "Verification Status", "Onboarding Step", "Created Date"];
        const rows = users.map(u => [
          u._id.toString(),
          `${u.firstName} ${u.lastName}`,
          u.emailAddress,
          u.identityVerificationStatus,
          u.onboardingStep,
          u.createdAt ? new Date(u.createdAt).toISOString() : "N/A"
        ]);
        csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
        break;
      }
      case "risk": {
        const txs = await PaymentOrder.find({}).populate("invoiceId").populate("customerId");
        const headers = [
          "Payment Order ID", 
          "Invoice Number", 
          "Customer Company", 
          "Carrier", 
          "Collection Currency", 
          "Expected Collection Amount", 
          "Invoice Currency", 
          "Beneficiary Amount", 
          "Settlement Status"
        ];
        const rows = txs.map(t => {
          const inv = (t.invoiceId as any) || {};
          const cust = (t.customerId as any) || {};
          return [
            t._id.toString(),
            inv.invoiceNo || "N/A",
            cust.companyInfo?.legalCompanyName || `${cust.firstName} ${cust.lastName}`,
            inv.carrier || "N/A",
            t.collectionCurrency || "N/A",
            (t.expectedCollectionAmount || 0).toString(),
            t.invoiceCurrency || "N/A",
            (t.beneficiaryAmount || 0).toString(),
            t.status
          ];
        });
        csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
        break;
      }
      case "audit": {
        const logs = await AuditLog.find({}).populate("actorId").sort({ createdAt: -1 });
        const headers = ["Log ID", "Event Type", "Related Record ID", "Actor Name", "Role", "Timestamp"];
        const rows = logs.map(l => {
          const actor = (l.actorId as any) || {};
          return [
            l._id.toString(),
            l.event,
            l.relatedRecordId || "N/A",
            actor.firstName ? `${actor.firstName} ${actor.lastName}` : "System",
            actor.role || "SYSTEM",
            l.createdAt ? new Date(l.createdAt).toISOString() : "N/A"
          ];
        });
        csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
        break;
      }
      default:
        throw new AppError("Invalid report type identifier", 400);
    }

    return { filename, csv };
  }
}
