import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import * as fs from 'fs';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public client: Redis;
  private readonly socketPath = process.env.REDIS_SOCKET_PATH || '/var/run/redis/redis.sock';
  private readonly bookingLocksPrefix = 'booking-locks';

  constructor() {
    if (!fs.existsSync(this.socketPath)) {
      console.error('Redis socket tidak ditemukan di', this.socketPath);
    }

    this.client = new Redis({
      path: this.socketPath, 
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });

    this.client.connect().catch((err) => {
      console.error('Gagal konek ke Redis:', err.message);
    });
  }

  async onModuleDestroy() {
    try { await this.client.quit(); } catch {}
  }

  private bookingLockIndexKey(bookingId: string) {
    return `${this.bookingLocksPrefix}:${bookingId}`;
  }

  async rememberSlotLocks(bookingId: string, slotKeys: string[], ttlSeconds: number) {
    if (!slotKeys.length) {
      return;
    }

    await this.client.set(
      this.bookingLockIndexKey(bookingId),
      JSON.stringify(slotKeys),
      'EX',
      ttlSeconds,
    );
  }

  async releaseSlotLocksForBooking(bookingId: string) {
    const recordKey = this.bookingLockIndexKey(bookingId);
    const payload = await this.client.get(recordKey);

    if (!payload) {
      return;
    }

    await this.client.del(recordKey);

    try {
      const slotKeys: string[] = JSON.parse(payload);
      if (Array.isArray(slotKeys) && slotKeys.length) {
        await this.client.del(...slotKeys);
      }
    } catch {
      // Ignore JSON parse issues and continue
    }
  }
}
