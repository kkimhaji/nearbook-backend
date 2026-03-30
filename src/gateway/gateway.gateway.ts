import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { GatewayService } from './gateway.service';
import { GatewayEvents } from './gateway.events';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  nickname?: string;
  username?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class NearBookGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly gatewayService: GatewayService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) { }

  // ─── 연결 / 해제 ───────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, nickname: true },
      });

      if (!user) {
        client.disconnect();
        return;
      }

      client.userId = user.id;
      client.username = user.username;
      client.nickname = user.nickname;

      this.gatewayService.register(user.id, client.id);

      client.emit(GatewayEvents.AUTHENTICATED, {
        userId: user.id,
        username: user.username,
        nickname: user.nickname,
      });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.gatewayService.remove(client.id);
  }

  // ─── 타이핑 인디케이터 ─────────────────────────────────────

  @SubscribeMessage(GatewayEvents.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetUserId: string; requestId: number },
  ): void {
    const targetSocketId = this.gatewayService.getSocketId(data.targetUserId);
    if (!targetSocketId) return;

    this.server.to(targetSocketId).emit(GatewayEvents.GUESTBOOK_TYPING_START, {
      requestId: data.requestId,
      writer: {
        userId: client.userId,
        username: client.username,
        nickname: client.nickname,
      },
    });
  }

  @SubscribeMessage(GatewayEvents.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetUserId: string; requestId: number },
  ): void {
    const targetSocketId = this.gatewayService.getSocketId(data.targetUserId);
    if (!targetSocketId) return;

    this.server.to(targetSocketId).emit(GatewayEvents.GUESTBOOK_TYPING_STOP, {
      requestId: data.requestId,
      writer: {
        userId: client.userId,
        username: client.username,
        nickname: client.nickname,
      },
    });
  }

  // ─── BLE 감지 결과 ─────────────────────────────────────────

  @SubscribeMessage(GatewayEvents.BLE_DETECTED)
  async handleBleDetected(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceTokens: string[] },
  ): Promise<void> {
    if (!client.userId) return;

    // device_token → user 변환 (4단계에서 BleToken 모델 추가 후 구현)
    // 현재는 기본 구조만 작성
    const detectedUsers = await this.resolveDeviceTokens(
      data.deviceTokens,
      client.userId,
    );

    client.emit(GatewayEvents.BLE_DETECTED_RESULT, { detectedUsers });
  }

  // ─── 외부에서 호출하는 emit 메서드들 ──────────────────────

  emitFriendRequestReceived(receiverId: string, payload: object): void {
    const socketId = this.gatewayService.getSocketId(receiverId);
    if (!socketId) return;
    this.server.to(socketId).emit(GatewayEvents.FRIEND_REQUEST_RECEIVED, payload);
  }

  emitFriendRequestAccepted(requesterId: string, payload: object): void {
    const socketId = this.gatewayService.getSocketId(requesterId);
    if (!socketId) return;
    this.server.to(socketId).emit(GatewayEvents.FRIEND_REQUEST_ACCEPTED, payload);
  }

  emitGuestbookRequestReceived(writerId: string, payload: object): void {
    const socketId = this.gatewayService.getSocketId(writerId);
    if (!socketId) return;
    this.server.to(socketId).emit(GatewayEvents.GUESTBOOK_REQUEST_RECEIVED, payload);
  }

  emitGuestbookRequestRejected(ownerId: string, payload: object): void {
    const socketId = this.gatewayService.getSocketId(ownerId);
    if (!socketId) return;
    this.server.to(socketId).emit(GatewayEvents.GUESTBOOK_REQUEST_REJECTED, payload);
  }

  emitGuestbookCompleted(ownerId: string, payload: object): void {
    const socketId = this.gatewayService.getSocketId(ownerId);
    if (!socketId) return;
    this.server.to(socketId).emit(GatewayEvents.GUESTBOOK_COMPLETED, payload);
  }

  private async resolveDeviceTokens(
    tokens: string[],
    requesterId: string,
  ): Promise<object[]> {
    if (tokens.length === 0) return [];

    const now = new Date();

    const bleTokens = await this.prisma.bleToken.findMany({
      where: {
        token: { in: tokens },
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            bleVisibility: true,
          },
        },
      },
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true },
    });

    const results: object[] = [];

    for (const bleToken of bleTokens) {
      const { user } = bleToken;

      if (user.id === requesterId) continue;

      if (user.bleVisibility === 'hidden') continue;

      if (user.bleVisibility === 'friends_only') {
        const friendship = await this.prisma.friendship.findFirst({
          where: {
            OR: [
              { requesterId, receiverId: user.id, status: 'accepted' },
              { requesterId: user.id, receiverId: requesterId, status: 'accepted' },
            ],
          },
        });

        if (!friendship) continue;
      }

      results.push({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
      });
    }

    return results;
  }
}