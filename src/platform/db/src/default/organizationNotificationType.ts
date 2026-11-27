import { db } from '../db';
import { ID } from '../id';
import { createEnsureRecord } from '../lib';

export let ensureOrganizationNotificationType = createEnsureRecord(
  db.organizationNotificationType,
  d => ({
    identifier: d.identifier
  }),
  async () => ({
    id: await ID.generateId('organizationNotificationType')
  })
);
