import { db } from '@metorial/db';

type DirtyTrackerClient = Pick<typeof db, 'auditLogDirtyTracker'>;

export let markAuditLogOrganizationDirty = async (
  organizationOid: bigint,
  client: DirtyTrackerClient = db
) => {
  await client.auditLogDirtyTracker.upsert({
    where: { organizationOid },
    create: { organizationOid },
    update: { revision: { increment: 1 } }
  });
};
