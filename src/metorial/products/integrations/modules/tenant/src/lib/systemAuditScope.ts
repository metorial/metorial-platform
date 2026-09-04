import { db } from '@metorial-subspace/db';
import type { AuditActor, AuditScope } from '@metorial/audit-scope';

let organizationOidByInstanceOid = new Map<bigint, bigint>();
let organizationOidByProjectOid = new Map<bigint, bigint>();

export let resolveOrganizationOidForInstance = async (instanceOid: bigint) => {
  let cached = organizationOidByInstanceOid.get(instanceOid);
  if (cached !== undefined) return cached;

  let instance = await db.instance.findUnique({
    where: { oid: instanceOid },
    select: { organizationOid: true }
  });
  if (!instance) return null;

  organizationOidByInstanceOid.set(instanceOid, instance.organizationOid);
  return instance.organizationOid;
};

export let resolveOrganizationOidForProject = async (projectOid: bigint) => {
  let cached = organizationOidByProjectOid.get(projectOid);
  if (cached !== undefined) return cached;

  let project = await db.project.findUnique({
    where: { oid: projectOid },
    select: { organizationOid: true }
  });
  if (!project) return null;

  organizationOidByProjectOid.set(projectOid, project.organizationOid);
  return project.organizationOid;
};

export let createSubspaceSystemAuditActor = (d: {
  job: string;
  metadata?: Record<string, string | number | boolean | null>;
}): AuditActor => ({
  type: 'system',
  id: d.job,
  ...(d.metadata ? { metadata: d.metadata } : {})
});

export let getSubspaceSystemAuditScope = async (d: {
  job: string;
  instanceOid?: bigint | null;
  projectOid?: bigint | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<AuditScope | null> => {
  let actor = createSubspaceSystemAuditActor({ job: d.job, metadata: d.metadata });

  if (d.instanceOid != null) {
    let organizationOid = await resolveOrganizationOidForInstance(d.instanceOid);
    if (organizationOid !== null) {
      return {
        organizationOid,
        instanceOid: d.instanceOid,
        actor,
        context: { ip: '' }
      };
    }
  }

  if (d.projectOid != null) {
    let organizationOid = await resolveOrganizationOidForProject(d.projectOid);
    if (organizationOid !== null) {
      return { organizationOid, actor, context: { ip: '' } };
    }
  }

  return null;
};
