import { createClient } from '@lowerdeck/rpc-client';
import { env } from './env';

// Declared locally rather than imported: subspace already depends on the slates client, so a
// package dependency in this direction would create a cycle.
export type SubspaceInternalClient = {
  callbackEvent: {
    receive: (input: {
      tenantIdentifier: string;
      callbackId: string;
      callbackInstanceId: string;
      triggerEventId: string;
      triggerRegistrationId: string;
      triggerGroupKey: string;
      triggerKey: string;
      source: 'webhook' | 'polling';
      webhookEventId?: string;
      mappedType?: string;
      mappedId?: string;
      occurredAt: Date;
    }) => Promise<{ received: boolean }>;
  };
};

let client: SubspaceInternalClient | null = null;

export let getSubspaceClient = () => {
  let endpoint = env.subspace.SUBSPACE_INTERNAL_URL;
  if (!endpoint) return null;

  client ??= createClient<SubspaceInternalClient>({ endpoint });

  return client;
};
