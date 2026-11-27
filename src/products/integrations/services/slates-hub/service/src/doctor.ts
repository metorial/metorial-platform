import { type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  dependencyCheck,
  objectStorageChecks,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks,
  rpcDependencyCheck
} from '@metorial/doctor';
import { trustPublisherCheck } from '@metorial-platform-systems/runtime-trust-publisher';
import type { RedisClient } from 'bun';
import { db } from '@mtsrc/slates-hub-db/db';
import { ensureEgressTrustPublisher } from './egressTrust';
import { env } from '@mtsrc/slates-hub-env/env';
import { storage } from '@mtsrc/slates-hub-storage/storage';

export let slatesHubDoctorChecks = (redis: RedisClient): CheckDefinition[] => {
  let egressTrustPublisher = ensureEgressTrustPublisher();

  return [
    ...baselineChecks(),
    ...postgresChecks({
      name: 'slates_hub',
      query: prismaQuery(db),
      schemaProbe: () => db.hub.count()
    }),
    ...redisChecks({ client: bunRedis(redis) }),
    ...objectStorageChecks({
      client: storage,
      buckets: [env.storage.INVOCATIONS_BUCKET_NAME]
    }),
    ...queueChecks(),
    rpcDependencyCheck({ name: 'functions', endpoint: env.functionBay.FUNCTION_BAY_API_URL }),
    ...(env.registry.SLATES_REGISTRY_URL
      ? [
          dependencyCheck({
            name: 'integration-registry',
            tcp: env.registry.SLATES_REGISTRY_URL
          })
        ]
      : []),
    ...(egressTrustPublisher ? [trustPublisherCheck(egressTrustPublisher)] : [])
  ];
};
