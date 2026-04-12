import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NearBookGateway } from './gateway.gateway';
import { GatewayService } from './gateway.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    UserModule,
  ],
  providers: [NearBookGateway, GatewayService],
  exports: [NearBookGateway, GatewayService],
})
export class GatewayModule {}