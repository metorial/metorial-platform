import { createClient } from '@lowerdeck/rpc-client';
import type { ClientOpts } from '@lowerdeck/rpc-client/dist/shared/clientBuilder';
import type { SlatesRegistryClient } from '../../../apps/registry/src/apis/internal';

export let createSlatesRegistryInternalClient = (o: ClientOpts): SlatesRegistryClient =>
  createClient<SlatesRegistryClient>(o);
