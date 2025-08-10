import { Client, createClient } from './generated';

export let createPrivateClient = (opts: { address: string }) => {
  let client = createClient({
    url: opts.address,
    credentials: 'include'
  });

  return client;
};

export type PrivateClient = Client;
