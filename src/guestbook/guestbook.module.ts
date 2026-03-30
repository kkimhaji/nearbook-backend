import { Module, forwardRef } from '@nestjs/common';
import { GuestbookController } from './guestbook.controller';
import { GuestbookService } from './guestbook.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [forwardRef(() => GatewayModule)],
  controllers: [GuestbookController],
  providers: [GuestbookService],
  exports: [GuestbookService],
})
export class GuestbookModule {}