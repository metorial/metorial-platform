import { createClient } from '@metorial/rpc/client';
import type { CustomPortalClient } from './src';

let getCustomPortalBatchKey = (d: { name: string; payload: any }) => {
  if (d.name == 'boot:bootPortal') {
    return 'boot:bootPortal';
  }

  if (typeof d.payload == 'object' && d.payload && typeof d.payload.portalId == 'string') {
    return `portal:${d.payload.portalId}`;
  }
};

export let createCustomPortalClient = (endpoint: string) => {
  return createClient<CustomPortalClient>({
    endpoint,
    referrerPolicy: 'unsafe-url',
    getBatchKey: d => getCustomPortalBatchKey(d)
  });
};

export type { CustomPortalClient };
