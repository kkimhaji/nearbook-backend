import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) { }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          { email: dto.email },
        ],
      },
    });

    if (exists) {
      if (exists.username === dto.username) {
        throw new ConflictException('이미 사용 중인 아이디입니다.');
      }
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        nickname: dto.nickname,
        email: dto.email,
        password: hashedPassword,
      },
    });

    return this.issueAndStoreTokens(user.id, user.username);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다.');
    }

    return this.issueAndStoreTokens(user.id, user.username);
  }

  /**
   * Refresh Token으로 Access Token / Refresh Token을 재발급한다 (Rotation).
   * 재사용된(탈취된) Refresh Token으로 판단되면 해당 계정의 모든 세션을 무효화한다.
   */
  async refresh(dto: RefreshTokenDto): Promise<TokenPair> {
    let payload: { sub: string; username: string };

    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('재로그인이 필요합니다.');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      dto.refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenValid) {
      // DB에 저장된 해시와 다른 토큰이 들어옴 → 탈취/재사용 가능성
      // 해당 계정의 세션을 전부 끊어 추가 피해를 차단
      await this.invalidateRefreshToken(user.id);
      throw new UnauthorizedException('재로그인이 필요합니다.');
    }

    return this.issueAndStoreTokens(user.id, user.username);
  }

  async logout(userId: string): Promise<void> {
    await this.invalidateRefreshToken(userId);
  }

  private async issueAndStoreTokens(
    userId: string,
    username: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: userId, username });

    const refreshToken = this.jwtService.sign(
      { sub: userId, username },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN') as any,
      },
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private async invalidateRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // 이메일 존재 여부를 응답으로 노출하지 않음 (보안)
    if (!user) return;

    const tempPassword = crypto.randomBytes(5).toString('hex');
    const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // 비밀번호 재설정 시 기존 Refresh Token도 함께 무효화 (탈취된 계정 보호)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, hashedRefreshToken: null },
    });

    await this.mailService.sendTempPassword(email, tempPassword);
  }
}