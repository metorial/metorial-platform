import { createClient } from '@mtsrc/rpc-client';
import type { RelayClient } from '../../../relay/service/src/controllers';

export * from './templates';

type ClientOpts = Parameters<typeof createClient>[0];

export type EmailIdentity = Awaited<ReturnType<RelayClient['emailIdentity']['get']>>;

export let createRelayClient = (o: ClientOpts) => {
  let inner = createClient<RelayClient>(o);

  return inner;
};
