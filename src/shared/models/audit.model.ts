import { Schema, model, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  actorId: Types.ObjectId;
  event: string;
  relatedRecordId?: string;
  previousValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: String, required: true },
    relatedRecordId: { type: String },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Compliance queries typically filter by actor and time range
AuditLogSchema.index({ actorId: 1, createdAt: -1 });

// Admin audit log views filter by event type
AuditLogSchema.index({ event: 1, createdAt: -1 });

// Record-level drill-down: "show me all events for paymentOrder X"
AuditLogSchema.index({ relatedRecordId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);
