import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const redisUrl = configService.getOrThrow<string>('REDIS_URL');

  // Redis Adapter 설정
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  const ioAdapter = new IoAdapter(app);
  app.useWebSocketAdapter(ioAdapter);

  const httpServer = app.getHttpServer();
  const { Server } = await import('socket.io');
  const io = new Server(httpServer);
  io.adapter(createAdapter(pubClient, subClient));

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('NearBook API')
    .setDescription('NearBook 방명록 앱 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}

bootstrap();