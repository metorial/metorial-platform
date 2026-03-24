import { createClient } from '@lowerdeck/rpc-client';
import { ClientOpts } from '@lowerdeck/rpc-client/dist/shared/clientBuilder';
import type { OriginClient } from '../../../apps/service/src/controllers';

export let createOriginClient = (o: ClientOpts) => createClient<OriginClient>(o);
