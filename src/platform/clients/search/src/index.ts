import { createClient } from '@lowerdeck/rpc-client';
import type { VoyagerClient } from '../../../services/search/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createVoyagerClient = (o: ClientOpts): VoyagerClient =>
  createClient<VoyagerClient>(o);
