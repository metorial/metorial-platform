import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureSecretType = createEnsureRecord(
  db.secretType,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('secretType')
  })
);
