import { createClient } from '@mtsrc/rpc-client';
import type { InternalClient } from '../../../ares/service/src/apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAresInternalClient = (o: ClientOpts): InternalClient =>
  createClient<InternalClient>(o);
