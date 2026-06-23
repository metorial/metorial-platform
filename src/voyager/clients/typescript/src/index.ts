import { createClient } from '@lowerdeck/rpc-client';
import { ClientOpts } from '@lowerdeck/rpc-client/dist/shared/clientBuilder';
import type { VoyagerClient } from '../../../service/src/controllers';

export let createVoyagerClient = (o: ClientOpts) => createClient<VoyagerClient>(o);
