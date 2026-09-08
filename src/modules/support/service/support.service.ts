import { Ticket, ITicket, IChatMessage } from "../models/ticket.model";
import { AppError } from "../../../shared/utils/AppError";
import { SocketService } from "../../../shared/services/socket.service";

export class SupportService {
  async getTicketsForUser(customerId: string): Promise<ITicket[]> {
    return Ticket.find({ customerId }).sort({ createdAt: -1 });
  }

  private mapToTicketDto(ticket: any) {
    return {
      id: ticket._id.toString(),
      ticketId: ticket.ticketId,
      title: ticket.title,
      status: ticket.status,
      createdAt: ticket.date,
      messages: ticket.messages.map((m: any) => ({
        id: m._id.toString(),
        sender: m.name,
        senderInitials: m.initials,
        timestamp: m.date,
        content: m.message,
        isStaffReply: m.sender === "agent"
      }))
    };
  }

  async createTicket(
    customerId: string,
    title: string,
    messageText: string,
    name: string,
    initials: string
  ): Promise<ITicket> {
    if (!title || !messageText) {
      throw new AppError("Title and initial message are required.", 400);
    }

    // Unique ticket ID generation
    const crypto = require("crypto");
    let ticketId = "";
    let isUnique = false;
    while (!isUnique) {
      ticketId = "T-" + crypto.randomBytes(3).toString("hex").toUpperCase();
      const exists = await Ticket.findOne({ ticketId });
      if (!exists) {
        isUnique = true;
      }
    }

    const now = new Date();
    // Preformatted date representation, e.g., "16 Jul 2026 10:50 am"
    const dateStr = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    }) + " " + now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toLowerCase();

    const initialChat: IChatMessage = {
      sender: "customer",
      initials,
      name,
      date: dateStr,
      message: messageText,
      createdAt: now
    };

    const ticket = new Ticket({
      customerId,
      ticketId,
      status: "New",
      title,
      date: dateStr,
      messages: [initialChat]
    });

    const savedTicket = await ticket.save();
    const dto = this.mapToTicketDto(savedTicket);
    
    // Broadcast ticket creation dynamically
    SocketService.getInstance().emitGlobal("ticket:update", dto);

    return savedTicket;
  }

  async replyToTicket(
    ticketId: string,
    customerId: string,
    messageText: string,
    name: string,
    initials: string
  ): Promise<ITicket> {
    if (!messageText) {
      throw new AppError("Message content is required.", 400);
    }

    const ticket = await Ticket.findOne({ _id: ticketId, customerId });
    if (!ticket) {
      throw new AppError("Ticket not found.", 404);
    }

    if (ticket.status === "Resolved") {
      throw new AppError("Cannot reply to a resolved ticket.", 400);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    }) + " " + now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toLowerCase();

    const newChat: IChatMessage = {
      sender: "customer",
      initials,
      name,
      date: dateStr,
      message: messageText,
      createdAt: now
    };

    ticket.messages.push(newChat);
    
    // Automatically transition to "In Progress" when user replies
    if (ticket.status === "New") {
      ticket.status = "In Progress";
    }

    const savedTicket = await ticket.save();
    const dto = this.mapToTicketDto(savedTicket);

    // Push live update to the ticket chatroom and global lists
    SocketService.getInstance().emitToRoom(savedTicket._id.toString(), "ticket:message", dto);
    SocketService.getInstance().emitGlobal("ticket:update", dto);

    return savedTicket;
  }
}


