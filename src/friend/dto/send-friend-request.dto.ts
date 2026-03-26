import { IsString } from 'class-validator';

export class SendFriendRequestDto {
  @IsString()
  receiverUsername: string;
}