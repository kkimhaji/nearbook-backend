import { Injectable, Inject } from '@nestjs/common';
import { createClient } from 'redis';
import { REDIS_CLIENT } from '../redis/redis.module';
import * as crypto from 'crypto';

type RedisClient = ReturnType<typeof createClient>;

const BLE_TOKEN_TTL_SECONDS = 600; // 10분
const BLE_TOKEN_PREFIX = 'ble:token:';

@Injectable()
export class BleTokenService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: RedisClient,
  ) { }

  async issueToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    await this.revokeToken(userId);

    // 16bytes → 8bytes (hex 32자 → 16자)
    const token = crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + BLE_TOKEN_TTL_SECONDS * 1000);

    await this.redis.set(
      `${BLE_TOKEN_PREFIX}${token}`,
      userId,
      { EX: BLE_TOKEN_TTL_SECONDS },
    );

    await this.redis.set(
      `ble:user:${userId}`,
      token,
      { EX: BLE_TOKEN_TTL_SECONDS },
    );

    return { token, expiresAt };
  }

  async resolveToken(token: string): Promise<string | null> {
    return this.redis.get(`${BLE_TOKEN_PREFIX}${token}`);
  }

  async resolveTokens(tokens: string[]): Promise<Map<string, string>> {
    if (tokens.length === 0) return new Map();

    // 다수의 토큰을 한 번에 조회 (mGet)
    const keys = tokens.map((t) => `${BLE_TOKEN_PREFIX}${t}`);
    const values = await this.redis.mGet(keys);

    const result = new Map<string, string>();
    tokens.forEach((token, index) => {
      const userId = values[index];
      if (userId) result.set(token, userId);
    });

    return result;
  }

  private async revokeToken(userId: string): Promise<void> {
    const existingToken = await this.redis.get(`ble:user:${userId}`);
    if (existingToken) {
      await this.redis.del(`${BLE_TOKEN_PREFIX}${existingToken}`);
    }
    await this.redis.del(`ble:user:${userId}`);
  }
}