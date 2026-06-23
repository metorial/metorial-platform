import { createClient } from '@lowerdeck/rpc-client';
import type { VoyagerClient } from '../../../service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createVoyagerClient = (o: ClientOpts): VoyagerClient => createClient<VoyagerClient>(o);
