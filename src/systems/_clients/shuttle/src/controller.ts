import { createClient } from '@lowerdeck/rpc-client';

type ClientOpts = Parameters<typeof createClient>[0];

export let createShuttleClient = (o: ClientOpts) => createClient<any>(o);
