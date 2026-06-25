import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let allDiscoveriesLoader = createLoader({
  name: 'allDiscoveries',
  fetch: (params: { status?: 'succeeded' | 'failed'; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.list(params)),
  mutators: {}
});

export let useAllDiscoveries = (status?: 'succeeded' | 'failed') =>
  usePaginatedLoader(allDiscoveriesLoader, { status });

export let slateDiscoveriesLoader = createLoader({
  name: 'slateDiscoveries',
  fetch: (params: {
    slateId: string;
    versionIds?: string[];
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slateDiscovery.list(params)),
  mutators: {}
});

export let useSlateDiscoveries = (slateId: string | undefined, versionIds?: string[]) =>
  usePaginatedLoader(slateDiscoveriesLoader, slateId ? { slateId, versionIds } : null);

export let slateDiscoveryLoader = createLoader({
  name: 'slateDiscovery',
  fetch: (params: { slateId: string; slateVersionId: string; slateDiscoveryId: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.get(params)),
  mutators: {},
  parents: [slateDiscoveriesLoader]
});

export let useSlateDiscovery = (
  slateId: string | undefined,
  versionId: string | undefined,
  discoveryId: string | undefined
) =>
  slateDiscoveryLoader.use(
    slateId && versionId && discoveryId
      ? { slateId, slateVersionId: versionId, slateDiscoveryId: discoveryId }
      : null
  );

let discoveryBuildOutputLoader = createLoader({
  name: 'discoveryBuildOutput',
  fetch: (params: { slateId: string; slateVersionId: string; slateDiscoveryId: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.getBuildOutput(params)),
  mutators: {}
});

export let useDiscoveryBuildOutput = (
  slateId: string | undefined,
  versionId: string | undefined,
  discoveryId: string | undefined
) =>
  discoveryBuildOutputLoader.use(
    slateId && versionId && discoveryId
      ? { slateId, slateVersionId: versionId, slateDiscoveryId: discoveryId }
      : null
  );

let discoverySpecificationLoader = createLoader({
  name: 'discoverySpecification',
  fetch: (params: { slateId: string; slateVersionId: string; slateDiscoveryId: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.getSpecification(params)),
  mutators: {}
});

export let useDiscoverySpecification = (
  slateId: string | undefined,
  versionId: string | undefined,
  discoveryId: string | undefined
) =>
  discoverySpecificationLoader.use(
    slateId && versionId && discoveryId
      ? { slateId, slateVersionId: versionId, slateDiscoveryId: discoveryId }
      : null
  );

let discoveryToolCallStatsLoader = createLoader({
  name: 'discoveryToolCallStats',
  fetch: (params: { slateId: string; slateVersionId: string; slateDiscoveryId: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.getToolCallStats(params)),
  mutators: {}
});

export let useDiscoveryToolCallStats = (
  slateId: string | undefined,
  versionId: string | undefined,
  discoveryId: string | undefined
) =>
  discoveryToolCallStatsLoader.use(
    slateId && versionId && discoveryId
      ? { slateId, slateVersionId: versionId, slateDiscoveryId: discoveryId }
      : null
  );
