import { type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  objectStorageChecks,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { db } from './db';
import { env } from './env';
import { storage } from './storage';

export let slatesRegistryDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'slates_registry',
    query: prismaQuery(db),
    schemaProbe: () => db.tenant.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...objectStorageChecks({ client: storage, buckets: [env.storage.PACKAGE_BUCKET_NAME] }),
  ...queueChecks()
];
