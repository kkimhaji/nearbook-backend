import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FriendModule } from './friend/friend.module';
import { UserModule } from './user/user.module';
import { GatewayModule } from './gateway/gateway.module';
import { GuestbookModule } from './guestbook/guestbook.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    FriendModule,
    UserModule,
    GatewayModule,
    GuestbookModule,
    RedisModule,
  ],
})
export class AppModule {}