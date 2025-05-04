import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureEmailIdentity = createEnsureRecord(
  db.emailIdentity,
  d => ({
    slug: d.slug
  }),
  async () => ({
    id: await ID.generateId('emailIdentity')
  })
);
