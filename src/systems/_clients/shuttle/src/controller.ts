import { createClient } from '@mtsrc/rpc-client';
import type { ShuttleClient } from '../../../shuttle/service/src/apis/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createShuttleClient = (o: ClientOpts): ShuttleClient =>
  createClient<ShuttleClient>(o);
