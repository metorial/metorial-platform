import { createClient, type ClientOpts } from '@lowerdeck/rpc-client';
import type { SlatesRegistryClient } from '../../../apps/registry/src/apis/internal';

export let createSlatesRegistryInternalClient = (o: ClientOpts): SlatesRegistryClient =>
  createClient<SlatesRegistryClient>(o);
