import { createClient } from '@lowerdeck/rpc-client';
import type { ForgeClient } from '../../../services/build/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createForgeClient = (o: ClientOpts): ForgeClient => createClient<ForgeClient>(o);
