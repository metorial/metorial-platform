import { createClient } from '@mtsrc/rpc-client';
import type { SlatesHubClient } from '../../../slates/apps/hub/src/apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSlatesHubInternalClient = (o: ClientOpts): SlatesHubClient =>
  createClient<SlatesHubClient>(o);
