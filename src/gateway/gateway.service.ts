import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GatewayService {
  // userId → socketId 매핑
  private readonly connectedUsers = new Map<string, string>();

  register(userId: string, socketId: string): void {
    this.connectedUsers.set(userId, socketId);
  }

  remove(socketId: string): void {
    for (const [userId, sid] of this.connectedUsers.entries()) {
      if (sid === socketId) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  isOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}