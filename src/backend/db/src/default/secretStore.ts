import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureSecretStore = createEnsureRecord(
  db.secretStore,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('secretStore')
  })
);
