import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '300', 10);

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (process.env.USE_REDIS !== 'true') return null;
  if (!client) {
    try {
      client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });
      client.on('error', (err) => console.error('[Redis]', err.message));
    } catch (e) {
      console.warn('[Redis] No se pudo conectar:', (e as Error).message);
      return null;
    }
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.get(key);
    return val ? JSON.parse(val) as T : null;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttl = CACHE_TTL): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttl, JSON.stringify(value));
  } catch { /* ignore */ }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.del(key); } catch { /* ignore */ }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const keys = await r.keys(pattern);
    if (keys.length) await r.del(...keys);
  } catch { /* ignore */ }
}

export async function pub(channel: string, message: unknown): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try { await r.publish(channel, JSON.stringify(message)); } catch { /* ignore */ }
}
