import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname: string;
}