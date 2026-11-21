import { db, type Instance, type Organization, type Project } from '@metorial/db';
import { readFromPrimary } from './primary';

export let isOrganizationLinked = async (organization: Pick<Organization, 'oid'>) =>
  !!(
    await readFromPrimary(db =>
      db.organization.findUnique({
        where: { oid: organization.oid },
        select: { agentTrackingLinkedAt: true }
      })
    )
  )?.agentTrackingLinkedAt;

export let isProjectLinked = async (project: Pick<Project, 'oid'>) =>
  !!(
    await readFromPrimary(db =>
      db.project.findUnique({
        where: { oid: project.oid },
        select: { agentTrackingLinkedAt: true }
      })
    )
  )?.agentTrackingLinkedAt;

export let isInstanceLinked = async (instance: Pick<Instance, 'oid'>) =>
  !!(
    await readFromPrimary(db =>
      db.instance.findUnique({
        where: { oid: instance.oid },
        select: { agentTrackingLinkedAt: true }
      })
    )
  )?.agentTrackingLinkedAt;

export let markOrganizationLinked = async (organization: Pick<Organization, 'oid'>) => {
  await db.organization.updateMany({
    where: { oid: organization.oid, agentTrackingLinkedAt: null },
    data: { agentTrackingLinkedAt: new Date() }
  });
};

export let markProjectLinked = async (project: Pick<Project, 'oid'>) => {
  await db.project.updateMany({
    where: { oid: project.oid, agentTrackingLinkedAt: null },
    data: { agentTrackingLinkedAt: new Date() }
  });
};

export let markInstanceLinked = async (instance: Pick<Instance, 'oid'>) => {
  await db.instance.updateMany({
    where: { oid: instance.oid, agentTrackingLinkedAt: null },
    data: { agentTrackingLinkedAt: new Date() }
  });
};

export let unlinkProject = async (project: Pick<Project, 'oid'>) => {
  await db.project.updateMany({
    where: { oid: project.oid, agentTrackingLinkedAt: { not: null } },
    data: { agentTrackingLinkedAt: null }
  });
};

export let unlinkInstance = async (instance: Pick<Instance, 'oid'>) => {
  await db.instance.updateMany({
    where: { oid: instance.oid, agentTrackingLinkedAt: { not: null } },
    data: { agentTrackingLinkedAt: null }
  });
};

export let unlinkOrganizationTree = async (organization: Pick<Organization, 'oid'>) => {
  await Promise.all([
    db.organization.updateMany({
      where: { oid: organization.oid, agentTrackingLinkedAt: { not: null } },
      data: { agentTrackingLinkedAt: null }
    }),
    db.project.updateMany({
      where: { organizationOid: organization.oid, agentTrackingLinkedAt: { not: null } },
      data: { agentTrackingLinkedAt: null }
    }),
    db.instance.updateMany({
      where: { organizationOid: organization.oid, agentTrackingLinkedAt: { not: null } },
      data: { agentTrackingLinkedAt: null }
    })
  ]);
};
