import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { BleTokenService } from './ble-token.service';

@Module({
  controllers: [UserController],
  providers: [UserService, BleTokenService],
  exports: [BleTokenService],
})
export class UserModule {}