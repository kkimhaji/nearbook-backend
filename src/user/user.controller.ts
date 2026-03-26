import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString } from 'class-validator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('search')
  searchUser(
    @Query('username') username: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.userService.searchByUsername(username, user.id);
  }
}