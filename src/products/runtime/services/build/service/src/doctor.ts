import { isServiceError } from '@lowerdeck/error';
import { check, type CheckDefinition } from '@lowerdeck/doctor';
import { createClusterManagerClient } from '@metorial-platform-systems/cluster-manager-client';
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

let clusterManagerTimeoutMs = 5_000;

let clusterManagerCheck = () => {
  let client = createClusterManagerClient({
    endpoint: env.clusterManager.CLUSTER_MANAGER_URL!,
    tokenFile: env.clusterManager.CLUSTER_MANAGER_TOKEN_FILE,
    timeoutMs: clusterManagerTimeoutMs
  });

  // An unknown run answers build_not_found, which proves both the route and our token work.
  return dependencyCheck({
    name: 'cluster-manager',
    run: async () => {
      try {
        await client.build.get({ runId: 'metorial-doctor' });
      } catch (error) {
        if (isServiceError(error) && error.data.code == 'build_not_found') return;
        throw error;
      }
    }
  });
};

let providerCheck = (): CheckDefinition =>
  check({
    id: 'build.provider',
    title: 'Build provider is configured',
    category: 'configuration',
    severity: 'critical',
    run: ctx =>
      ctx.pass(`Builds run on the ${env.provider.DEFAULT_PROVIDER} provider.`, {
        provider: env.provider.DEFAULT_PROVIDER
      })
  });

export let buildDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'forge',
    query: prismaQuery(db),
    schemaProbe: () => db.tenant.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...objectStorageChecks({
    client: storage,
    buckets: [env.storage.LOG_BUCKET_NAME, env.storage.ARTIFACT_BUCKET_NAME]
  }),
  ...queueChecks(),
  providerCheck(),
  ...(env.provider.DEFAULT_PROVIDER == 'kubernetes' ? [clusterManagerCheck()] : [])
];
