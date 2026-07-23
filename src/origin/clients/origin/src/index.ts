import { createClient } from '@lowerdeck/rpc-client';
import type { OriginClient } from '../../../apps/service/src/controllers';
export type { OriginClient } from '../../../apps/service/src/controllers';
export type { RepositorySyncStatusSnapshot } from '../../../apps/service/src/services/repositorySyncState';

type ClientOpts = Parameters<typeof createClient>[0];

export let createOriginClient = (o: ClientOpts): OriginClient => createClient<OriginClient>(o);
