import { createClient } from '@lowerdeck/rpc-client';

type ClientOpts = Parameters<typeof createClient>[0];

export let createSlatesHubInternalClient = (o: ClientOpts) => createClient<any>(o);
