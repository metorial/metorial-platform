import { withTracingSuppressed } from '@lowerdeck/telemetry';
import { db } from '@metorial-subspace/db';
import { RedisClient } from 'bun';

let redis = new RedisClient(process.env.REDIS_URL?.replace('rediss://', 'redis://'), {
  tls: process.env.REDIS_URL?.startsWith('rediss://')
});

export let workerHealthFetch = async (_request: Request) =>
  withTracingSuppressed(async () => {
    try {
      await db.backend.count();
      await redis.ping();

      return new Response('OK');
    } catch {
      return new Response('Service Unavailable', { status: 503 });
    }
  });
