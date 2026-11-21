import {
  db,
  ID,
  isUniqueConstraintError,
  type Instance,
  type Organization,
  type Project
} from '@metorial/db';
import { readFromPrimary } from './primary';

// A concurrent ensure of the same scope stores the same id, the service upserts by ref.
let store = async (write: () => Promise<unknown>) => {
  try {
    await write();
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }
};

export let readOrganizationLink = async (organization: Pick<Organization, 'oid'>) =>
  (
    await readFromPrimary(db =>
      db.agentTrackingOrganizationLink.findUnique({
        where: { organizationOid: organization.oid }
      })
    )
  )?.serviceOrganizationId;

export let readProjectLink = async (project: Pick<Project, 'oid'>) =>
  (
    await readFromPrimary(db =>
      db.agentTrackingProjectLink.findUnique({ where: { projectOid: project.oid } })
    )
  )?.serviceProjectId;

export let readInstanceLink = async (instance: Pick<Instance, 'oid'>) =>
  (
    await readFromPrimary(db =>
      db.agentTrackingInstanceLink.findUnique({ where: { instanceOid: instance.oid } })
    )
  )?.serviceInstanceId;

// An organization the service re-created under a new id holds none of the old projects and
// instances, so their links go with the old organization link.
export let linkOrganization = async (
  organization: Pick<Organization, 'oid'>,
  serviceOrganizationId: string
) => {
  let current = await readOrganizationLink(organization);
  if (current && current != serviceOrganizationId) await unlinkOrganizationTree(organization);

  await store(async () =>
    db.agentTrackingOrganizationLink.upsert({
      where: { organizationOid: organization.oid },
      create: {
        id: await ID.generateId('agentTrackingOrganizationLink'),
        serviceOrganizationId,
        organizationOid: organization.oid
      },
      update: { serviceOrganizationId }
    })
  );
};

export let linkProject = (project: Pick<Project, 'oid'>, serviceProjectId: string) =>
  store(async () =>
    db.agentTrackingProjectLink.upsert({
      where: { projectOid: project.oid },
      create: {
        id: await ID.generateId('agentTrackingProjectLink'),
        serviceProjectId,
        projectOid: project.oid
      },
      update: { serviceProjectId }
    })
  );

export let linkInstance = (instance: Pick<Instance, 'oid'>, serviceInstanceId: string) =>
  store(async () =>
    db.agentTrackingInstanceLink.upsert({
      where: { instanceOid: instance.oid },
      create: {
        id: await ID.generateId('agentTrackingInstanceLink'),
        serviceInstanceId,
        instanceOid: instance.oid
      },
      update: { serviceInstanceId }
    })
  );

export let unlinkProject = async (project: Pick<Project, 'oid'>) => {
  await db.agentTrackingProjectLink.deleteMany({ where: { projectOid: project.oid } });
};

export let unlinkInstance = async (instance: Pick<Instance, 'oid'>) => {
  await db.agentTrackingInstanceLink.deleteMany({ where: { instanceOid: instance.oid } });
};

export let unlinkOrganizationTree = async (organization: Pick<Organization, 'oid'>) => {
  await Promise.all([
    db.agentTrackingOrganizationLink.deleteMany({
      where: { organizationOid: organization.oid }
    }),
    db.agentTrackingProjectLink.deleteMany({
      where: { project: { organizationOid: organization.oid } }
    }),
    db.agentTrackingInstanceLink.deleteMany({
      where: { instance: { organizationOid: organization.oid } }
    })
  ]);
};
