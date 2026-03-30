import { IsString, MinLength, MaxLength } from 'class-validator';

export class SubmitGuestbookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}