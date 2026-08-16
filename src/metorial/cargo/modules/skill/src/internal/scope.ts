import { ServiceError, preconditionFailedError } from '@lowerdeck/error';
import { db } from '@metorial/db';

type ScopedRecord = {
  id: string;
  projectOid: bigint | null;
  instanceOid?: bigint | null;
};

let unscoped = (resource: string, record: { id: string }, missing: string) =>
  new ServiceError(
    preconditionFailedError({
      message: `${resource} ${record.id} is not linked to ${missing}`
    })
  );

export let requireRecordScope = (resource: string, record: ScopedRecord) => {
  if (record.projectOid == null || record.instanceOid == null) {
    throw unscoped(resource, record, 'a project and instance');
  }

  return {
    project: { oid: record.projectOid },
    instance: { oid: record.instanceOid }
  };
};

export let requireRecordProject = (
  resource: string,
  record: Pick<ScopedRecord, 'id' | 'projectOid'>
) => {
  if (record.projectOid == null) throw unscoped(resource, record, 'a project');

  return { oid: record.projectOid };
};

export let getInstanceOrganizationOid = async (instance: { oid: bigint }) => {
  let { organizationOid } = await db.instance.findUniqueOrThrow({
    where: { oid: instance.oid },
    select: { organizationOid: true }
  });

  return organizationOid;
};

/**
 * Voyager and Origin partition their records by this identifier, so it must stay stable for a project
 * to keep existing search records and code buckets reachable.
 */
export let getProjectTenantIdentifier = (project: { oid: bigint }) => `mte-pro-${project.oid}`;
