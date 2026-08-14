import { createQueue } from '@lowerdeck/queue';
import { env } from '../../env';
import { getProjectScopeDrift } from '../../lib/legacyScope';

export let reconcileLegacyScopeProjectQueue = createQueue<{ projectOid: string }>({
  name: 'sub/ten/legacy/scope/project',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let reconcileLegacyScopeTenantSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/legacy/scope/tenant/search',
  redisUrl: env.service.REDIS_URL
});

export let reconcileLegacyScopeEnvironmentSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/legacy/scope/environment/search',
  redisUrl: env.service.REDIS_URL
});

export let enqueueLegacyScopeRepair = async (d: { projectOid: bigint | string }) => {
  let projectOid = d.projectOid.toString();

  await reconcileLegacyScopeProjectQueue.add(
    { projectOid },
    { id: `subspace-legacy-scope:${projectOid}` }
  );
};

export let deferToLegacyScopeReconciler = async (d: { projectOid: bigint }) => {
  let drift = await getProjectScopeDrift(d);
  if (!drift.hasDrift) return false;

  await enqueueLegacyScopeRepair({ projectOid: d.projectOid });
  return true;
};
