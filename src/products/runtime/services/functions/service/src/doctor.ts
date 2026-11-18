import { check, type CheckDefinition } from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  objectStorageChecks,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks,
  rpcDependencyCheck
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { db } from './db';
import { env } from './env';
import { getClusterManager } from './providers/knative/clusterManager';
import { storage } from './storage';

let providerCheck = (): CheckDefinition =>
  check({
    id: 'functions.provider',
    title: 'Function provider is configured',
    category: 'configuration',
    severity: 'critical',
    run: ctx => {
      let provider = env.provider.DEFAULT_PROVIDER;
      let missing =
        provider == 'knative'
          ? [!env.clusterManager.CLUSTER_MANAGER_URL && 'CLUSTER_MANAGER_URL'].filter(Boolean)
          : [];

      if (missing.length) {
        return ctx.fail({
          message: `The ${provider} provider needs ${missing.join(', ')}.`,
          resolution: { summary: 'Set runtime.provider and its settings in your Helm values.' }
        });
      }

      return ctx.pass(`Functions run on the ${provider} provider.`, { provider });
    }
  });

export let functionsDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'function_bay',
    query: prismaQuery(db),
    schemaProbe: () => db.tenant.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...objectStorageChecks({ client: storage, buckets: [env.storage.BUNDLE_BUCKET_NAME] }),
  ...queueChecks(),
  providerCheck(),
  ...(env.provider.DEFAULT_PROVIDER == 'knative' && env.clusterManager.CLUSTER_MANAGER_URL
    ? [rpcDependencyCheck({ name: 'cluster-manager', client: getClusterManager() })]
    : [])
];
