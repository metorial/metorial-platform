import { createClient } from '@mtsrc/rpc-client';
import type { OriginClient } from '../../../origin/apps/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createOriginClient = (o: ClientOpts): OriginClient => createClient<OriginClient>(o);
