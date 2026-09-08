import { Ticket, ITicket, IChatMessage } from "../../support/models/ticket.model";
import { User } from "../../../shared/models/user.model";
import { AppError } from "../../../shared/utils/AppError";
import { SocketService } from "../../../shared/services/socket.service";

export class AdminSupportService {
  private formatMessageDate(date: Date): string {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).toLowerCase();
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

  async getAllTickets() {
    const tickets = await Ticket.find({}).sort({ createdAt: -1 });
    return tickets.map(t => this.mapToTicketDto(t));
  }

  async replyToTicket(ticketId: string, adminId: string, messageText: string) {
    const admin = await User.findById(adminId);
    if (!admin) throw new AppError("Administrator account not found.", 404);

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) throw new AppError("Ticket not found.", 404);

    const now = new Date();
    const initials = `${admin.firstName[0] || ""}${admin.lastName[0] || ""}`.toUpperCase() || "S";

    const reply: IChatMessage = {
      sender: "agent",
      initials,
      name: `${admin.firstName} ${admin.lastName}`,
      date: this.formatMessageDate(now),
      message: messageText,
      createdAt: now
    };

    ticket.messages.push(reply);

    // Automatically transition to "In Progress" if a staff member replies to a "New" ticket
    if (ticket.status === "New") {
      ticket.status = "In Progress";
    }

    await ticket.save();
    const dto = this.mapToTicketDto(ticket);
    
    // Live update dispatch
    SocketService.getInstance().emitToRoom(ticket._id.toString(), "ticket:message", dto);
    SocketService.getInstance().emitGlobal("ticket:update", dto);

    return dto;
  }

  async updateTicketStatus(ticketId: string, status: "New" | "In Progress" | "Resolved") {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) throw new AppError("Ticket not found.", 404);

    ticket.status = status;
    await ticket.save();
    const dto = this.mapToTicketDto(ticket);

    // Notify room of status change and push global update
    SocketService.getInstance().emitToRoom(ticket._id.toString(), "ticket:status", dto);
    SocketService.getInstance().emitGlobal("ticket:update", dto);

    return dto;
  }

  async createAdminTicket(adminId: string, customerEmail: string, title: string, initialMessage: string) {
    const admin = await User.findById(adminId);
    if (!admin) throw new AppError("Admin not found.", 404);

    const customer = await User.findOne({ emailAddress: customerEmail.toLowerCase() });
    if (!customer) throw new AppError("Customer with specified email address not found.", 404);

    let ticketId = "";
    let isUnique = false;
    let counter = 0;
    const count = await Ticket.countDocuments();
    while (!isUnique) {
      ticketId = `T-${String(count + 1 + counter).padStart(3, "0")}`;
      const exists = await Ticket.findOne({ ticketId });
      if (!exists) {
        isUnique = true;
      } else {
        counter++;
      }
    }

    const now = new Date();
    const dateStr = this.formatMessageDate(now);
    const initials = `${admin.firstName[0] || ""}${admin.lastName[0] || ""}`.toUpperCase() || "S";

    const initialChat: IChatMessage = {
      sender: "agent",
      initials,
      name: `${admin.firstName} ${admin.lastName}`,
      date: dateStr,
      message: initialMessage,
      createdAt: now
    };

    const ticket = new Ticket({
      customerId: customer._id,
      ticketId,
      status: "New",
      title,
      date: dateStr,
      messages: [initialChat]
    });

    await ticket.save();
    const dto = this.mapToTicketDto(ticket);

    // Broadcast newly initiated ticket global list
    SocketService.getInstance().emitGlobal("ticket:update", dto);

    return dto;
  }
}
