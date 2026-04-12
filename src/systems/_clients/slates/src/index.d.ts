import { createClient } from '@lowerdeck/rpc-client';
import type { SlatesHubClient } from '../../../slates/apps/hub/src/apis/internal';

export declare let createSlatesHubInternalClient: (
  o: Parameters<typeof createClient>[0]
) => SlatesHubClient;
