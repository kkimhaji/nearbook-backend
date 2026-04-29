import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { BleTokenService } from './ble-token.service';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'profiles'),
        filename: (_req, file, cb) => {
          // 파일명 충돌 방지: uuid + 원본 확장자
          cb(null, `${crypto.randomUUID()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        // 이미지 파일만 허용
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
          cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [UserController],
  providers: [UserService, BleTokenService],
  exports: [BleTokenService],
})
export class UserModule {}