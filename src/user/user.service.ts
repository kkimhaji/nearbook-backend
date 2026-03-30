import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async searchByUsername(username: string, requesterId: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        nickname: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    if (user.id === requesterId) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    // 친구 관계 여부 함께 반환
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: requesterId, receiverId: user.id },
          { requesterId: user.id, receiverId: requesterId },
        ],
      },
      select: { id: true, status: true, requesterId: true },
    });

    return {
      ...user,
      friendshipStatus: friendship?.status ?? null,
      friendshipId: friendship?.id ?? null,
      isRequester: friendship?.requesterId === requesterId,
    };
  }

  async issueBleToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분

    // 기존 토큰 삭제 후 새로 발급
    await this.prisma.bleToken.deleteMany({ where: { userId } });

    const bleToken = await this.prisma.bleToken.create({
      data: { userId, token, expiresAt },
    });

    return { token: bleToken.token, expiresAt: bleToken.expiresAt };
  }
}