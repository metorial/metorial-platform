import { createClient } from '@metorial/rpc/client';
import type { CustomPortalClient } from './index';

export let createCustomPortalClient = (host: string) =>
  createClient<CustomPortalClient>({
    endpoint: `${host}/metorial-custom-portal`
  });
