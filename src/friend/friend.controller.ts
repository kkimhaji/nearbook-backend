import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  UseGuards,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseIntPipe } from '@nestjs/common';

@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) { }

  @Post('request')
  sendRequest(
    @CurrentUser() user: { id: string },
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendService.sendRequest(user.id, dto);
  }


  @Patch('request/:id/accept')
  acceptRequest(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) friendshipId: number,
  ) {
    return this.friendService.acceptRequest(user.id, friendshipId);
  }

  @Patch('request/:id/reject')
  rejectRequest(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) friendshipId: number,
  ) {
    return this.friendService.rejectRequest(user.id, friendshipId);
  }

  @Get()
  getFriends(@CurrentUser() user: { id: string }) {
    return this.friendService.getFriends(user.id);
  }

  @Get('requests/received')
  getReceivedRequests(@CurrentUser() user: { id: string }) {
    return this.friendService.getReceivedRequests(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteFriend(
    @CurrentUser() user: { id: string },
    @Param('id', ParseIntPipe) friendshipId: number,
  ) {
    return this.friendService.deleteFriend(user.id, friendshipId);
  }
}