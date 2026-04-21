import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        console.log(`[Redis] 연결 시도: ${redisUrl}`);

        const client = createClient({ url: redisUrl });

        client.on('error', (err) => console.error('[Redis] 연결 오류:', err));
        client.on('connect', () => console.log('[Redis] 연결 성공 ✅'));
        client.on('ready', () => console.log('[Redis] 준비 완료 ✅'));

        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule { }