import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { slateStatsLoader, slateLoader, slatesLoader } from './slates.js';
import { slateVersionsLoader } from './versions.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let allDeploymentsLoader = createLoader({
  name: 'allDeployments',
  fetch: (params: {
    status?: 'pending' | 'running' | 'succeeded' | 'failed';
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slateDeployment.list(params)),
  mutators: {}
});

export let useAllDeployments = (status?: 'pending' | 'running' | 'succeeded' | 'failed') =>
  usePaginatedLoader(allDeploymentsLoader, { status });

export let slateDeploymentsLoader = createLoader({
  name: 'slateDeployments',
  fetch: (params: {
    slateId: string;
    versionIds?: string[];
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slateDeployment.list(params)),
  mutators: {}
});

export let useSlateDeployments = (slateId: string | undefined, versionIds?: string[]) =>
  usePaginatedLoader(slateDeploymentsLoader, slateId ? { slateId, versionIds } : null);

let isAfterQueuedAt = (createdAt: Date | string, queuedAt: Date | string) =>
  new Date(createdAt).getTime() >= new Date(queuedAt).getTime();

export let listRedeployDeployments = async (
  redeploys: {
    slateId: string;
    versionId: string;
    queuedAt: Date | string;
  }[]
) => {
  if (redeploys.length === 0) return [];

  let byVersionId = new Map(redeploys.map(redeploy => [redeploy.versionId, redeploy]));
  let list = await withAuthRedirect(() =>
    adminClient.slateDeployment.list({
      versionIds: [...byVersionId.keys()]
    })
  );

  return list.items.filter(deployment => {
    if (!deployment.version?.id) return false;

    let redeploy = byVersionId.get(deployment.version.id);
    if (!redeploy) return false;
    if (deployment.slate?.id !== redeploy.slateId) return false;

    return isAfterQueuedAt(deployment.createdAt, redeploy.queuedAt);
  });
};

export let waitForRedeployDeployment = async (d: {
  slateId: string;
  versionId: string;
  queuedAt: Date | string;
  timeoutMs?: number;
}) => {
  let startedAt = Date.now();
  let timeoutMs = d.timeoutMs ?? 30_000;

  while (Date.now() - startedAt < timeoutMs) {
    let deployments = await listRedeployDeployments([d]);
    let deployment = deployments[0];
    if (deployment) return deployment;

    await new Promise(resolve => window.setTimeout(resolve, 1000));
  }

  return null;
};

export let slateDeploymentLoader = createLoader({
  name: 'slateDeployment',
  fetch: (params: { slateId: string; slateDeploymentId: string }) =>
    withAuthRedirect(() => adminClient.slateDeployment.get(params)),
  mutators: {},
  parents: [slateDeploymentsLoader]
});

export let useSlateDeployment = (
  slateId: string | undefined,
  deploymentId: string | undefined
) =>
  slateDeploymentLoader.use(
    slateId && deploymentId ? { slateId, slateDeploymentId: deploymentId } : null
  );

let buildOutputLoader = createLoader({
  name: 'buildOutput',
  fetch: (params: { slateId: string; slateDeploymentId: string }) =>
    withAuthRedirect(() => adminClient.slateDeployment.getBuildOutput(params)),
  mutators: {}
});

export let useBuildOutput = (slateId: string | undefined, deploymentId: string | undefined) =>
  buildOutputLoader.use(
    slateId && deploymentId ? { slateId, slateDeploymentId: deploymentId } : null
  );

let internalLogsLoader = createLoader({
  name: 'internalLogs',
  fetch: (params: { slateId: string; slateDeploymentId: string }) =>
    withAuthRedirect(() => adminClient.slateDeployment.getInternalLogs(params)),
  mutators: {}
});

export let useInternalLogs = (slateId: string | undefined, deploymentId: string | undefined) =>
  internalLogsLoader.use(
    slateId && deploymentId ? { slateId, slateDeploymentId: deploymentId } : null
  );

export let redeploySlateDeployment = async (slateId: string, slateDeploymentId: string) => {
  let result = await withAuthRedirect(() =>
    adminClient.slateDeployment.redeploy({ slateId, slateDeploymentId })
  );
  slateLoader.refetchAll();
  slatesLoader.refetchAll();
  slateStatsLoader.refetchAll();
  slateVersionsLoader.refetchAll();
  slateDeploymentLoader.refetchAll();
  allDeploymentsLoader.refetchAll();
  slateDeploymentsLoader.refetchAll();

  return result;
};

export let redeployLatestSlate = async (slateId: string) => {
  let result = await withAuthRedirect(() =>
    adminClient.slateDeployment.redeployLatest({ slateId })
  );
  slateLoader.refetchAll();
  slatesLoader.refetchAll();
  slateStatsLoader.refetchAll();
  slateVersionsLoader.refetchAll();
  slateDeploymentLoader.refetchAll();
  allDeploymentsLoader.refetchAll();
  slateDeploymentsLoader.refetchAll();

  return result;
};

export let bulkRedeployLatestSlates = async (slateIds: string[]) => {
  let result = await withAuthRedirect(() =>
    adminClient.slateDeployment.bulkRedeployLatest({ slateIds })
  );
  slateLoader.refetchAll();
  slatesLoader.refetchAll();
  slateStatsLoader.refetchAll();
  slateVersionsLoader.refetchAll();
  slateDeploymentLoader.refetchAll();
  allDeploymentsLoader.refetchAll();
  slateDeploymentsLoader.refetchAll();

  return result;
};
