import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let slatesLoader = createLoader({
  name: 'slates',
  fetch: (params: { after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.slate.list(params)),
  mutators: {}
});

export let useSlates = () => usePaginatedLoader(slatesLoader, {});

export let slateLoader = createLoader({
  name: 'slate',
  fetch: (slateId: string) => withAuthRedirect(() => adminClient.slate.get({ slateId })),
  mutators: {},
  parents: [slatesLoader]
});

export let useSlate = (slateId: string | undefined) => slateLoader.use(slateId || null);

export let slateStatsLoader = createLoader({
  name: 'slateStats',
  fetch: (slateId: string) => withAuthRedirect(() => adminClient.slate.getStats({ slateId })),
  mutators: {},
  parents: [slateLoader]
});

export let useSlateStats = (slateId: string | undefined) =>
  slateStatsLoader.use(slateId || null);
