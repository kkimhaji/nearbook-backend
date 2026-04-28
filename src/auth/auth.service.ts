import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) { }

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
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

    return { accessToken: this.issueToken(user.id, user.username) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
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

    return { accessToken: this.issueToken(user.id, user.username) };
  }

  private issueToken(userId: string, username: string): string {
    return this.jwtService.sign({ sub: userId, username });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // 이메일 존재 여부를 응답으로 노출하지 않음 (보안)
    if (!user) return;

    const tempPassword = crypto.randomBytes(5).toString('hex'); // 10자리 hex
    const hashed = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await this.mailService.sendTempPassword(email, tempPassword);
  }
}