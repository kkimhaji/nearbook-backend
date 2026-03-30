import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FriendModule } from './friend/friend.module';
import { UserModule } from './user/user.module';
import { GatewayModule } from './gateway/gateway.module';
import { GuestbookModule } from './guestbook/guestbook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    FriendModule,
    UserModule,
    GatewayModule,
    GuestbookModule,
  ],
})
export class AppModule {}