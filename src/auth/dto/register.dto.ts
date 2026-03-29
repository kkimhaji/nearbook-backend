import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jihyeon_ha', description: '로그인 ID (영문, 숫자, 언더스코어)' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username은 영문, 숫자, 언더스코어만 사용 가능합니다.',
  })
  username: string;

  @ApiProperty({ example: '지현', description: '표시용 닉네임' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname: string;

  @ApiProperty({ example: 'jihyeon@example.com', description: '이메일' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @ApiProperty({ example: 'password123', description: '비밀번호 (8자 이상)' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}