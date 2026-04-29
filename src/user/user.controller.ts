import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateBleVisibilityDto } from './dto/update-ble-visibility.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: { id: string }) {
    return this.userService.getMyProfile(user.id);
  }

  @Get('search')
  searchUser(
    @Query('username') username: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.userService.searchByUsername(username, user.id);
  }

  @Post('ble-token')
  issueBleToken(@CurrentUser() user: { id: string }) {
    return this.userService.issueBleToken(user.id);
  }

  @Patch('nickname')
  updateNickname(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateNicknameDto,
  ) {
    return this.userService.updateNickname(user.id, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(user.id, dto);
  }

  @Patch('ble-visibility')
  updateBleVisibility(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateBleVisibilityDto,
  ) {
    return this.userService.updateBleVisibility(user.id, dto);
  }

  @Post('profile-image')
  @UseInterceptors(FileInterceptor('image'))
  uploadProfileImage(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('이미지 파일이 없습니다.');
    return this.userService.uploadProfileImage(user.id, file.filename);
  }

  @Delete('profile-image')
  @HttpCode(HttpStatus.OK)
  deleteProfileImage(@CurrentUser() user: { id: string }) {
    return this.userService.deleteProfileImage(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUser() user: { id: string }) {
    return this.userService.deleteAccount(user.id);
  }
}