import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureFilePurpose = createEnsureRecord(
  db.filePurpose,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('filePurpose')
  })
);
