import {
  ConsumerServerRequestsCreateBody,
  ConsumerServerRequestsListQuery
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let serverRequestsLoader = createLoader({
  name: 'serverRequests',
  parents: [],
  fetch: (i: ConsumerServerRequestsListQuery) =>
    withSdk(sdk => sdk.servers.serverRequests.list(i)),
  mutators: {}
});

export let useCreateServerRequest = serverRequestsLoader.createExternalMutator(
  (i: ConsumerServerRequestsCreateBody) => withSdk(sdk => sdk.servers.serverRequests.create(i))
);

export let useServerRequests = (query?: ConsumerServerRequestsListQuery) => {
  let data = usePaginator(pagination => serverRequestsLoader.use({ ...pagination, ...query }));

  return data;
};

export let serverRequestLoader = createLoader({
  name: 'serverRequest',
  parents: [],
  fetch: (i: { serverRequestId: string }) =>
    withSdk(sdk => sdk.servers.serverRequests.get(i.serverRequestId)),
  mutators: {}
});

export let useServerRequest = (serverRequestId: string | null | undefined) => {
  let data = serverRequestLoader.use(serverRequestId ? { serverRequestId } : null);

  return data;
};
