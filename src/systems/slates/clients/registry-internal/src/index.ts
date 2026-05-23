import { createClient } from '@mtsrc/rpc-client';
import type { ClientOpts } from '@mtsrc/rpc-client/dist/shared/clientBuilder';
import type { SlatesRegistryClient } from '../../../apps/registry/src/apis/internal';

export let createSlatesRegistryInternalClient = (o: ClientOpts): SlatesRegistryClient =>
  createClient<SlatesRegistryClient>(o);
