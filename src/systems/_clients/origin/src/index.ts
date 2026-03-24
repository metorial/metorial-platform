import { createClient } from '@lowerdeck/rpc-client';
import type { ClientOpts } from '@lowerdeck/rpc-client/dist/shared/clientBuilder';

export let createOriginClient = (o: ClientOpts) => createClient<any>(o);
