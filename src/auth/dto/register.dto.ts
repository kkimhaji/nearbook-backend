import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9가-힣_]+$/, {
    message: '닉네임은 영문, 숫자, 한글, 언더스코어만 사용 가능합니다.',
  })
  nickname: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}