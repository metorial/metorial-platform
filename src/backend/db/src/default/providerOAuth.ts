import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureProviderOAuthConfig = createEnsureRecord(
  db.providerOAuthConfig,
  d => ({
    instanceOid_type_configHash: {
      instanceOid: d.instanceOid!,
      configHash: d.configHash,
      type: d.type ?? 'json'
    }
  }),
  async () => ({
    id: await ID.generateId('oauthConfig')
  })
);
