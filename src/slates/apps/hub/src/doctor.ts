import { type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  dependencyCheck,
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

export let slatesHubDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'slates_hub',
    query: prismaQuery(db),
    schemaProbe: () => db.hub.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...objectStorageChecks({ client: storage, buckets: [env.storage.INVOCATIONS_BUCKET_NAME] }),
  ...queueChecks(),
  dependencyCheck({ name: 'functions', tcp: env.functionBay.FUNCTION_BAY_API_URL }),
  ...(env.registry.SLATES_REGISTRY_URL
    ? [
        dependencyCheck({
          name: 'integration-registry',
          tcp: env.registry.SLATES_REGISTRY_URL
        })
      ]
    : [])
];
