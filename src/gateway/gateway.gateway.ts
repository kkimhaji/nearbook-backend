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
import { GatewayEvents } from './gateway.events';
import { ConfigService } from '@nestjs/config';
import { BleTokenService } from 'src/user/ble-token.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  nickname?: string;
  username?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class NearBookGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly bleTokenService: BleTokenService,
  ) { }

async handleConnection(client: AuthenticatedSocket): Promise<void> {
  const token = client.handshake.auth?.token as string | undefined;

  if (!token) {
    console.log(`[Gateway] 연결 거부 - 토큰 없음 (socketId: ${client.id})`);
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
      console.log(`[Gateway] 연결 거부 - 유저 없음 (userId: ${payload.sub})`);
      client.disconnect();
      return;
    }

    client.userId = user.id;
    client.username = user.username;
    client.nickname = user.nickname;

    client.join(user.id);

    console.log(`[Gateway] 인증 성공 - ${user.username} (socketId: ${client.id})`);

    client.emit(GatewayEvents.AUTHENTICATED, {
      userId: user.id,
      username: user.username,
      nickname: user.nickname,
    });
  } catch (err) {
    console.log(`[Gateway] 인증 실패 (socketId: ${client.id}):`, err.message);
    client.disconnect();
  }
}

handleDisconnect(client: AuthenticatedSocket): void {
  console.log(`[Gateway] 연결 해제 - ${client.username ?? '미인증'} (socketId: ${client.id})`);
}

  @SubscribeMessage(GatewayEvents.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetUserId: string; requestId: number },
  ): void {
    this.server.to(data.targetUserId).emit(GatewayEvents.GUESTBOOK_TYPING_START, {
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
    this.server.to(data.targetUserId).emit(GatewayEvents.GUESTBOOK_TYPING_STOP, {
      requestId: data.requestId,
      writer: {
        userId: client.userId,
        username: client.username,
        nickname: client.nickname,
      },
    });
  }

  @SubscribeMessage(GatewayEvents.BLE_DETECTED)
  async handleBleDetected(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { deviceTokens: string[] },
  ): Promise<void> {
    if (!client.userId) return;

    console.log(`[BLE] ${client.username} 토큰 수신:`, data.deviceTokens);

    const detectedUsers = await this.resolveDeviceTokens(
      data.deviceTokens,
      client.userId,
    );

    console.log(`[BLE] ${client.username} 감지 결과:`, detectedUsers);

    client.emit(GatewayEvents.BLE_DETECTED_RESULT, { detectedUsers });
  }

  emitFriendRequestReceived(receiverId: string, payload: object): void {
    this.server.to(receiverId).emit(GatewayEvents.FRIEND_REQUEST_RECEIVED, payload);
  }

  emitFriendRequestAccepted(requesterId: string, payload: object): void {
    this.server.to(requesterId).emit(GatewayEvents.FRIEND_REQUEST_ACCEPTED, payload);
  }

  emitGuestbookRequestReceived(writerId: string, payload: object): void {
    this.server.to(writerId).emit(GatewayEvents.GUESTBOOK_REQUEST_RECEIVED, payload);
  }

  emitGuestbookRequestRejected(ownerId: string, payload: object): void {
    this.server.to(ownerId).emit(GatewayEvents.GUESTBOOK_REQUEST_REJECTED, payload);
  }

  emitGuestbookCompleted(ownerId: string, payload: object): void {
    this.server.to(ownerId).emit(GatewayEvents.GUESTBOOK_COMPLETED, payload);
  }

  private async resolveDeviceTokens(
    tokens: string[],
    requesterId: string,
  ): Promise<object[]> {
    if (tokens.length === 0) return [];

    const tokenUserMap = await this.bleTokenService.resolveTokens(tokens);
    if (tokenUserMap.size === 0) return [];

    const userIds = Array.from(tokenUserMap.values())
      .filter((id) => id !== requesterId);
    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        nickname: true,
        profileImageUrl: true,
        bleVisibility: true,
      },
    });

    const candidates = users.filter((u) => u.bleVisibility !== 'hidden');
    if (candidates.length === 0) return [];

    const allCandidateIds = candidates.map((u) => u.id);

    const friendships = allCandidateIds.length > 0
      ? await this.prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId, receiverId: { in: allCandidateIds } },
            { requesterId: { in: allCandidateIds }, receiverId: requesterId },
          ],
        },
        select: { requesterId: true, receiverId: true },
      })
      : [];

    const friendIds = new Set(
      friendships.map((f) =>
        f.requesterId === requesterId ? f.receiverId : f.requesterId,
      ),
    );

    return candidates
      .filter((u) => {
        if (u.bleVisibility === 'public') return true;
        if (u.bleVisibility === 'friends_only') return friendIds.has(u.id);
        return false;
      })
      .map(({ id, username, nickname, profileImageUrl }) => ({
        id,
        username,
        nickname,
        profileImageUrl,
        isFriend: friendIds.has(id),
      }));
  }
}