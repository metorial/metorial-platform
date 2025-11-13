import { createClient } from '@metorial/rpc/client';
import type { SSOClient } from './src/internal';

export let createSsoClient = (host: string) =>
  createClient<SSOClient>({
    endpoint: `${host}/metorial-sso`
  });
