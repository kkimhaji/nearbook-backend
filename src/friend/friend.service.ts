import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
  } from '@nestjs/common';
  import { PrismaService } from 'prisma/prisma.service';
  import { SendFriendRequestDto } from './dto/send-friend-request.dto';
  
  @Injectable()
  export class FriendService {
    constructor(private readonly prisma: PrismaService) {}
  
    async sendRequest(requesterId: string, dto: SendFriendRequestDto) {
      const receiver = await this.prisma.user.findUnique({
        where: { username: dto.receiverUsername },
        select: { id: true, username: true, nickname: true },
      });
  
      if (!receiver) {
        throw new NotFoundException('존재하지 않는 사용자입니다.');
      }
  
      if (receiver.id === requesterId) {
        throw new BadRequestException('자기 자신에게 친구 요청을 보낼 수 없습니다.');
      }
  
      const existing = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId, receiverId: receiver.id },
            { requesterId: receiver.id, receiverId: requesterId },
          ],
        },
      });
  
      if (existing) {
        if (existing.status === 'accepted') {
          throw new ConflictException('이미 친구입니다.');
        }
        throw new ConflictException('이미 친구 요청이 존재합니다.');
      }
  
      const friendship = await this.prisma.friendship.create({
        data: {
          requesterId,
          receiverId: receiver.id,
        },
        include: {
          receiver: {
            select: { id: true, username: true, nickname: true },
          },
        },
      });
  
      return friendship;
    }
  
    async acceptRequest(userId: string, friendshipId: string) {
      const friendship = await this.prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
  
      if (!friendship) {
        throw new NotFoundException('친구 요청을 찾을 수 없습니다.');
      }
  
      if (friendship.receiverId !== userId) {
        throw new ForbiddenException('수락 권한이 없습니다.');
      }
  
      if (friendship.status !== 'pending') {
        throw new BadRequestException('처리할 수 없는 요청입니다.');
      }
  
      return this.prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: 'accepted' },
        include: {
          requester: {
            select: { id: true, username: true, nickname: true },
          },
        },
      });
    }
  
    async rejectRequest(userId: string, friendshipId: string) {
      const friendship = await this.prisma.friendship.findUnique({
        where: { id: friendshipId },
      });
  
      if (!friendship) {
        throw new NotFoundException('친구 요청을 찾을 수 없습니다.');
      }
  
      if (friendship.receiverId !== userId) {
        throw new ForbiddenException('거절 권한이 없습니다.');
      }
  
      if (friendship.status !== 'pending') {
        throw new BadRequestException('처리할 수 없는 요청입니다.');
      }
  
      return this.prisma.friendship.delete({
        where: { id: friendshipId },
      });
    }
  
    async getFriends(userId: string) {
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId, status: 'accepted' },
            { receiverId: userId, status: 'accepted' },
          ],
        },
        include: {
          requester: {
            select: { id: true, username: true, nickname: true, profileImageUrl: true },
          },
          receiver: {
            select: { id: true, username: true, nickname: true, profileImageUrl: true },
          },
        },
      });
  
      // 상대방 정보만 추출
      return friendships.map((f) => ({
        friendshipId: f.id,
        friend: f.requesterId === userId ? f.receiver : f.requester,
        since: f.createdAt,
      }));
    }
  
    async getReceivedRequests(userId: string) {
      return this.prisma.friendship.findMany({
        where: {
          receiverId: userId,
          status: 'pending',
        },
        include: {
          requester: {
            select: { id: true, username: true, nickname: true, profileImageUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }