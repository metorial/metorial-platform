import { createClient } from '@lowerdeck/rpc-client';
import type { SlatesHubClient } from '../../../services/slates-hub/apis/internal/src';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSlatesHubInternalClient = (o: ClientOpts): SlatesHubClient =>
  createClient<SlatesHubClient>(o);
