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
import { db } from '@mtsrc/mcp-runtime-db';
import { env } from '@mtsrc/mcp-runtime-env';
import { storage } from '@mtsrc/mcp-runtime-storage';
import type { RedisClient } from 'bun';
import { ensureEgressTrustPublisher } from './egressTrust';

export let mcpRuntimeDoctorChecks = (redis: RedisClient): CheckDefinition[] => {
  let egressTrustPublisher = ensureEgressTrustPublisher();

  return [
    ...baselineChecks(),
    ...postgresChecks({
      name: 'shuttle',
      query: prismaQuery(db),
      schemaProbe: () => db.server.count()
    }),
    ...redisChecks({ client: bunRedis(redis) }),
    ...objectStorageChecks({ client: storage, buckets: [env.storage.LOGS_BUCKET_NAME] }),
    ...queueChecks(),
    rpcDependencyCheck({ name: 'functions', endpoint: env.functionBay.FUNCTION_BAY_API_URL }),
    ...(env.secrets.SHUTTLE_DELEGATE_SECRETS_TO_NEBULA
      ? [rpcDependencyCheck({ name: 'secret-store', endpoint: env.nebula.NEBULA_API_URL })]
      : []),
    ...(env.holopod.HOLOPOD_HTTP_ENDPOINT
      ? [
          dependencyCheck({
            name: 'holopod',
            severity: 'warning',
            tcp: env.holopod.HOLOPOD_HTTP_ENDPOINT
          })
        ]
      : []),
    ...(egressTrustPublisher ? [trustPublisherCheck(egressTrustPublisher)] : [])
  ];
};
