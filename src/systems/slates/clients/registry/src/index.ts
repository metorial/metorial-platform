import { hc } from 'hono/client';
import type { registryApp } from '../../../apps/registry/src/apis/public';

export type RegistryAppType = typeof registryApp;

export let createSlatesRegistryClient = (o: { endpoint: string; token?: string }) =>
  hc<RegistryAppType>(o.endpoint, {
    headers: o.token ? { Authorization: `Bearer ${o.token}` } : {},
    init: { redirect: 'follow' }
  });
