import { Redis } from 'ioredis';

const parsedTtl = Number(process.env.REDIS_SESSION_TTL);
const DEFAULT_TTL = Number.isFinite(parsedTtl) ? parsedTtl : 86_400;

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required for Redis connection');
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

const sessionKey = (sessionId: string) => `session:${sessionId}`;

async function touch(key: string, ttl = DEFAULT_TTL) {
  if (ttl > 0) {
    await redis.expire(key, ttl);
  }
}

export async function createSession(
  sessionId: string,
  ttl = DEFAULT_TTL,
): Promise<void> {
  const key = sessionKey(sessionId);
  await redis.hset(key, 'createdAt', JSON.stringify(Date.now()));
  await touch(key, ttl);
}

export async function touchSession(
  sessionId: string,
  ttl = DEFAULT_TTL,
): Promise<void> {
  await touch(sessionKey(sessionId), ttl);
}

export async function saveStepResult(
  sessionId: string,
  step: string,
  data: unknown,
  ttl = DEFAULT_TTL,
): Promise<void> {
  const key = sessionKey(sessionId);
  await redis.hset(key, step, JSON.stringify(data));
  await touch(key, ttl);
}

export async function setSessionField(
  sessionId: string,
  field: string,
  value: unknown,
  ttl = DEFAULT_TTL,
): Promise<void> {
  const key = sessionKey(sessionId);
  await redis.hset(key, field, JSON.stringify(value));
  await touch(key, ttl);
}

export async function getSession(
  sessionId: string,
  ttl = DEFAULT_TTL,
): Promise<Record<string, unknown>> {
  const key = sessionKey(sessionId);
  const hash = await redis.hgetall(key);
  await touch(key, ttl);
  return Object.fromEntries(
    Object.entries(hash).map(([k, v]) => {
      try {
        return [k, JSON.parse(v)];
      } catch {
        return [k, v];
      }
    }),
  );
}

export async function getSessionField<T = unknown>(
  sessionId: string,
  field: string,
  ttl = DEFAULT_TTL,
): Promise<T | undefined> {
  const key = sessionKey(sessionId);
  const val = await redis.hget(key, field);
  await touch(key, ttl);
  if (!val) return undefined;
  try {
    return JSON.parse(val) as T;
  } catch {
    return val as unknown as T;
  }
}
