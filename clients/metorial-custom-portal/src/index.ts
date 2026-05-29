import { createClient } from '@metorial/rpc/client';
import type { CustomPortalClient } from '../../../src/backend/apis/custom-portal/src';

type ClientOpts = Parameters<typeof createClient<CustomPortalClient>>[0];

export let createCustomPortalClient = (endpoint: string) =>
  createClient<CustomPortalClient>({
    endpoint,
    referrerPolicy: 'unsafe-url'
  });

export type { CustomPortalClient };
