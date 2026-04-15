import { createClient } from '@lowerdeck/rpc-client';
import type { ForgeClient } from '../../../forge/service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createForgeClient = (o: ClientOpts): ForgeClient => createClient<ForgeClient>(o);
