import { createClient } from '@lowerdeck/rpc-client';
import type { SignalClient } from '../../../service/src/controllers';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSignalClient = (o: ClientOpts): SignalClient => createClient<SignalClient>(o);
