import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { GuestbookService } from './guestbook.service';
import { RequestGuestbookDto } from './dto/request-guestbook.dto';
import { SubmitGuestbookDto } from './dto/submit-guestbook.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('guestbook')
export class GuestbookController {
  constructor(private readonly guestbookService: GuestbookService) { }

  @Post('request')
  requestGuestbook(
    @CurrentUser() user: { id: string },
    @Body() dto: RequestGuestbookDto,
  ) {
    return this.guestbookService.requestGuestbook(user.id, dto);
  }

  @Patch('request/:id/writing')
  markAsWriting(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) requestId: number,
  ) {
    return this.guestbookService.markAsWriting(user.id, requestId);
  }

  @Patch('request/:id/reject')
  rejectRequest(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) requestId: number,
  ) {
    return this.guestbookService.rejectRequest(user.id, requestId);
  }

  @Post('request/:id/submit')
  submitGuestbook(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) requestId: number,
    @Body() dto: SubmitGuestbookDto,
  ) {
    return this.guestbookService.submitGuestbook(user.id, requestId, dto);
  }

  @Get('mine')
  getMyGuestbook(
    @CurrentUser() user: { id: string },
    @Query('groupBy') groupBy: 'writer' | 'date' = 'date',
  ) {
    return this.guestbookService.getMyGuestbook(user.id, groupBy);
  }

  @Get('written')
  getWrittenGuestbook(
    @CurrentUser() user: { id: string },
    @Query('groupBy') groupBy: 'owner' | 'date' = 'date',
  ) {
    return this.guestbookService.getWrittenGuestbook(user.id, groupBy);
  }

  @Patch('request/:id/cancel-writing')
  cancelWriting(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) requestId: number,
  ) {
    return this.guestbookService.cancelWriting(user.id, requestId);
  }
}