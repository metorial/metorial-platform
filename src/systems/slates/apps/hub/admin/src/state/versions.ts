import { createLoader } from '@metorial/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { slateLoader } from './slates.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let slateVersionsLoader = createLoader({
  name: 'slateVersions',
  fetch: (params: { slateId: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.slateVersion.list(params)),
  mutators: {},
  parents: [slateLoader]
});

export let useSlateVersions = (slateId: string | undefined) =>
  usePaginatedLoader(slateVersionsLoader, slateId ? { slateId } : null);

export let slateVersionLoader = createLoader({
  name: 'slateVersion',
  fetch: (params: { slateId: string; slateVersionId: string }) =>
    withAuthRedirect(() => adminClient.slateVersion.get(params)),
  mutators: {},
  parents: [slateVersionsLoader]
});

export let useSlateVersion = (slateId: string | undefined, versionId: string | undefined) =>
  slateVersionLoader.use(slateId && versionId ? { slateId, slateVersionId: versionId } : null);

let versionSpecificationLoader = createLoader({
  name: 'versionSpecification',
  fetch: (params: { slateId: string; slateVersionId: string; slateDiscoveryId: string }) =>
    withAuthRedirect(() => adminClient.slateDiscovery.getSpecification(params)),
  mutators: {}
});

export let useVersionSpecification = (
  slateId: string | undefined,
  versionId: string | undefined,
  discoveryId: string | undefined
) =>
  versionSpecificationLoader.use(
    slateId && versionId && discoveryId
      ? { slateId, slateVersionId: versionId, slateDiscoveryId: discoveryId }
      : null
  );
