import { createClient } from '@lowerdeck/rpc-client';
import type { CustomPortalClient } from './src';

export let createPortalClient = (endpoint: string) => {
  return createClient<CustomPortalClient>({
    endpoint,
    referrerPolicy: 'unsafe-url',
    disableBatching: true,
    useDirectMethodRoute: true
  });
};

export type { CustomPortalClient };
