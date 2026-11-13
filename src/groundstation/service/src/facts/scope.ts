import { notFoundError, ServiceError } from '@lowerdeck/error';
import type { Organization } from '../../prisma/generated/client';
import { db } from '../db';

export type QueryScope = { projectIds?: string[]; instanceIds?: string[] };

let resolveIds = async (d: {
  organization: Organization;
  entity: 'project' | 'instance';
  idsOrRefs: string[];
}) => {
  let where = {
    organizationOid: d.organization.oid,
    OR: [{ id: { in: d.idsOrRefs } }, { ref: { in: d.idsOrRefs } }]
  };

  let rows =
    d.entity == 'project'
      ? await db.project.findMany({ where, select: { id: true, ref: true } })
      : await db.instance.findMany({ where, select: { id: true, ref: true } });

  let missing = d.idsOrRefs.find(
    value => !rows.some(row => row.id == value || row.ref == value)
  );
  if (missing) throw new ServiceError(notFoundError(d.entity, missing));

  return rows.map(row => row.id);
};

export let resolveQueryScope = async (d: {
  organization: Organization;
  scope?: QueryScope;
}): Promise<QueryScope> => ({
  projectIds: d.scope?.projectIds
    ? await resolveIds({
        organization: d.organization,
        entity: 'project',
        idsOrRefs: d.scope.projectIds
      })
    : undefined,
  instanceIds: d.scope?.instanceIds
    ? await resolveIds({
        organization: d.organization,
        entity: 'instance',
        idsOrRefs: d.scope.instanceIds
      })
    : undefined
});

export let instanceIdsOfScope = async (d: {
  organization: Organization;
  scope: QueryScope;
}) => {
  if (!d.scope.projectIds) return d.scope.instanceIds;

  let instances = await db.instance.findMany({
    where: {
      organizationOid: d.organization.oid,
      project: { id: { in: d.scope.projectIds } },
      ...(d.scope.instanceIds ? { id: { in: d.scope.instanceIds } } : {})
    },
    select: { id: true }
  });

  return instances.map(instance => instance.id);
};
