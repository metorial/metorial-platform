import { createClient } from '@lowerdeck/rpc-client';
import type { OriginClient } from '../../../apps/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createOriginClient = (o: ClientOpts): OriginClient => createClient<OriginClient>(o);
