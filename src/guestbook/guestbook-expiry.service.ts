import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GuestbookExpiryService {
  private readonly logger = new Logger(GuestbookExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleRequests(): Promise<void> {
    const { count } = await this.prisma.guestbookRequest.updateMany({
      where: {
        status: { in: ['pending', 'writing'] },
        expiresAt: { lt: new Date() },
      },
      data: { status: 'rejected' },
    });

    if (count > 0) {
      this.logger.log(`만료된 방명록 요청 ${count}건 처리 완료`);
    }
  }
}