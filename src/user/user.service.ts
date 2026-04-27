import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BleTokenService } from './ble-token.service';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateBleVisibilityDto } from './dto/update-ble-visibility.dto';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bleTokenService: BleTokenService,
  ) { }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        profileImageUrl: true,
        bleVisibility: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async updateNickname(userId: string, dto: UpdateNicknameDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { nickname: dto.nickname },
      select: { id: true, nickname: true },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }

    const hashed = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return { message: '비밀번호가 변경되었습니다.' };
  }

  async updateBleVisibility(userId: string, dto: UpdateBleVisibilityDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { bleVisibility: dto.bleVisibility },
      select: { id: true, bleVisibility: true },
    });
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: '계정이 삭제되었습니다.' };
  }

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

    if (!user) throw new NotFoundException('존재하지 않는 사용자입니다.');
    if (user.id === requesterId) throw new NotFoundException('존재하지 않는 사용자입니다.');

    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, receiverId: user.id },
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

  async issueBleToken(userId: string) {
    return this.bleTokenService.issueToken(userId);
  }
}