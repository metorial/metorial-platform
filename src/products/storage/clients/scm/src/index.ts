import { createClient } from '@lowerdeck/rpc-client';
import type { OriginClient } from '../../../services/scm/services/api/src/controllers';
export type { OriginClient } from '../../../services/scm/services/api/src/controllers';
export type { RepositorySyncStatusSnapshot } from '../../../services/scm/services/api/src/services/repositorySyncState';

type ClientOpts = Parameters<typeof createClient>[0];

export let createOriginClient = (o: ClientOpts): OriginClient => createClient<OriginClient>(o);
