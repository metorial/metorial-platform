import { createClient } from '@lowerdeck/rpc-client';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSignalClient = (o: ClientOpts) => createClient<any>(o);
