import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly transporter: nodemailer.Transporter;

    constructor(private readonly config: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: config.getOrThrow<string>('SMTP_HOST'),
            port: config.getOrThrow<number>('SMTP_PORT'),
            secure: false,
            auth: {
                user: config.getOrThrow<string>('SMTP_USER'),
                pass: config.getOrThrow<string>('SMTP_PASS'),
            },
        });
    }

    async sendTempPassword(to: string, tempPassword: string): Promise<void> {
        await this.transporter.sendMail({
            from: this.config.getOrThrow<string>('SMTP_FROM'),
            to,
            subject: '[NearBook] 임시 비밀번호 안내',
            html: `
        <div style="font-family: sans-serif; max-width: 480px;">
          <h2>임시 비밀번호 안내</h2>
          <p>아래 임시 비밀번호로 로그인 후 반드시 비밀번호를 변경해주세요.</p>
          <div style="background:#f4f4f4; padding:16px; border-radius:8px; font-size:24px; letter-spacing:4px; text-align:center;">
            <strong>${tempPassword}</strong>
          </div>
          <p style="color:#888; font-size:13px; margin-top:16px;">
            본인이 요청하지 않은 경우 이 메일을 무시하세요.
          </p>
        </div>
      `,
        });
    }
}