import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureProviderOAuthConfig = createEnsureRecord(
  db.providerOAuthConfig,
  d => ({
    instanceOid_configHash: {
      instanceOid: d.instanceOid!,
      configHash: d.configHash
    }
  }),
  async () => ({
    id: await ID.generateId('oauthConfig')
  })
);
