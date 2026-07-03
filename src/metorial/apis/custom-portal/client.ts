import { createClient } from '@lowerdeck/rpc-client';
import type { CustomPortalClient } from './src';

export let createCustomPortalClient = (endpoint: string) => {
  return createClient<CustomPortalClient>({
    endpoint,
    referrerPolicy: 'unsafe-url'
  });
};

export type { CustomPortalClient };
