import { Server as SocketServer } from "socket.io";
import http from "http";

export class SocketService {
  private static instance: SocketService;
  private io: SocketServer | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public init(server: http.Server): SocketServer {
    this.io = new SocketServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on("connection", (socket) => {
      console.log(`[SocketService] Client connected: ${socket.id}`);

      // Channel tickets subscription
      socket.on("join-ticket", (ticketId: string) => {
        socket.join(ticketId);
        console.log(`[SocketService] Client ${socket.id} joined ticket room: ${ticketId}`);
      });

      socket.on("leave-ticket", (ticketId: string) => {
        socket.leave(ticketId);
        console.log(`[SocketService] Client ${socket.id} left ticket room: ${ticketId}`);
      });

      socket.on("disconnect", () => {
        console.log(`[SocketService] Client disconnected: ${socket.id}`);
      });
    });

    return this.io;
  }

  public emitToRoom(room: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  public emitGlobal(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}
