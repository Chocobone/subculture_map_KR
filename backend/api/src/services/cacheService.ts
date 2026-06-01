import Redis from 'ioredis';

let client: Redis;

function getClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
  }
  return client;
}

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const value = await getClient().get(key);
    return value ? (JSON.parse(value) as T) : null;
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await getClient().del(...keys);
  },

  // KEYS 대신 SCAN 사용 — 운영 Redis에서 블로킹 없이 패턴 삭제
  async scanDel(pattern: string): Promise<void> {
    const redis = getClient();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  },
};
