import { createLoader } from '@metorial/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
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
  await withAuthRedirect(() =>
    adminClient.slateDeployment.redeploy({ slateId, slateDeploymentId })
  );
  slateDeploymentLoader.refetchAll();
  allDeploymentsLoader.refetchAll();
  slateDeploymentsLoader.refetchAll();
};
