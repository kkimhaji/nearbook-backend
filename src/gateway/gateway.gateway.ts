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
import { BleTokenService } from 'src/user/ble-token.service';

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
    private readonly bleTokenService: BleTokenService,
  ) { }


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
  
    // 1. Redis에서 token → userId 일괄 변환
    const tokenUserMap = await this.bleTokenService.resolveTokens(tokens);
  
    if (tokenUserMap.size === 0) return [];
  
    const userIds = Array.from(tokenUserMap.values())
      .filter((id) => id !== requesterId);
  
    if (userIds.length === 0) return [];
  
    // 2. 유저 정보 일괄 조회
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
  
    // 3. hidden 제외
    const candidates = users.filter((u) => u.bleVisibility !== 'hidden');
  
    if (candidates.length === 0) return [];
  
    // 4. friends_only 친구 관계 일괄 조회
    const friendsOnlyIds = candidates
      .filter((u) => u.bleVisibility === 'friends_only')
      .map((u) => u.id);
  
    const friendships =
      friendsOnlyIds.length > 0
        ? await this.prisma.friendship.findMany({
            where: {
              status: 'accepted',
              OR: [
                { requesterId, receiverId: { in: friendsOnlyIds } },
                { requesterId: { in: friendsOnlyIds }, receiverId: requesterId },
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
  
    // 5. visibility 필터링
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