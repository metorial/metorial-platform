import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureServerRunner = createEnsureRecord(
  db.serverRunner,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('serverRunner')
  })
);
