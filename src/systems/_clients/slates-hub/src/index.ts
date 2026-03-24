import { createClient } from '@lowerdeck/rpc-client';
import type { SlatesHubClient } from '../../../apps/hub/src/apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSlatesHubInternalClient = (o: ClientOpts) => createClient<SlatesHubClient>(o);
