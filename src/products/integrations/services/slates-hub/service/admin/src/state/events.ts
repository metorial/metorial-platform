import { createLoader } from '@metorial-io/data-hooks';
import { adminClient, withAuthRedirect } from '../hooks/client.js';
import { usePaginatedLoader } from './usePaginatedLoader.js';

export let allEventsLoader = createLoader({
  name: 'allEvents',
  fetch: (params: { type?: string; after?: string; before?: string }) =>
    withAuthRedirect(() => adminClient.slateEvent.list(params)),
  mutators: {}
});

export let useAllEvents = (type?: string) => usePaginatedLoader(allEventsLoader, { type });

export let slateEventsLoader = createLoader({
  name: 'slateEvents',
  fetch: (params: {
    slateId: string;
    versionIds?: string[];
    after?: string;
    before?: string;
  }) => withAuthRedirect(() => adminClient.slateEvent.list(params)),
  mutators: {}
});

export let useSlateEvents = (slateId: string | undefined, versionIds?: string[]) =>
  usePaginatedLoader(slateEventsLoader, slateId ? { slateId, versionIds } : null);
