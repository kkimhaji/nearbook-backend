import { IsString } from 'class-validator';

export class RequestGuestbookDto {
  @IsString()
  writerUsername: string;
}