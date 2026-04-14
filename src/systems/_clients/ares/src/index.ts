import { createClient } from '@lowerdeck/rpc-client';
import type { AuthClient } from '../../../ares/service/src/apis/auth/controllers';
import type { InternalClient } from '../../../ares/service/src/apis/internal';

type ClientOpts = Parameters<typeof createClient>[0];

export let createAresInternalClient = (o: ClientOpts): InternalClient =>
  createClient<InternalClient>(o);

export let createAresAuthClient = (o: ClientOpts) =>
  createClient<{
    oauth: AuthClient['oauth'];
  }>(o);
