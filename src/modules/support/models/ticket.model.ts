import { Schema, model, Document, Types } from "mongoose";

export interface IChatMessage {
  sender: "customer" | "agent";
  initials: string;
  name: string;
  date: string;
  message: string;
  createdAt: Date;
}

export interface ITicket extends Document {
  customerId: Types.ObjectId;
  ticketId: string;
  status: "New" | "In Progress" | "Resolved";
  title: string;
  date: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  sender: { type: String, enum: ["customer", "agent"], required: true },
  initials: { type: String, required: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TicketSchema = new Schema<ITicket>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ticketId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["New", "In Progress", "Resolved"],
      default: "New"
    },
    title: { type: String, required: true },
    date: { type: String, required: true },
    messages: [ChatMessageSchema]
  },
  { timestamps: true }
);

export const Ticket = model<ITicket>("Ticket", TicketSchema);
