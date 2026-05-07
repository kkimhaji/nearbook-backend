import { Module, forwardRef } from '@nestjs/common';
import { GuestbookController } from './guestbook.controller';
import { GuestbookService } from './guestbook.service';
import { GatewayModule } from '../gateway/gateway.module';
import { GuestbookExpiryService } from './guestbook-expiry.service'; 

@Module({
  imports: [forwardRef(() => GatewayModule)],
  providers: [GuestbookService, GuestbookExpiryService],
  controllers: [GuestbookController],
  exports: [GuestbookService],
})
export class GuestbookModule {}