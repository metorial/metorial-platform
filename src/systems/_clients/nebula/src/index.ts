import { createClient } from '@lowerdeck/rpc-client';
import type { NebulaClient } from '../../../nebula/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createNebulaClient = (o: ClientOpts): NebulaClient => createClient<NebulaClient>(o);
