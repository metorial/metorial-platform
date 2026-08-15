import type {
  Instance as MetorialInstance,
  Organization as MetorialOrganization,
  OrganizationActor as MetorialOrganizationActor,
  Project as MetorialProject
} from '@metorial/db';
import { db as subspaceDb } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';

export let assertMirrorIdentity = (
  resource: string,
  expected: { oid: bigint; id: string },
  matches: { oid: bigint; id: string }[]
) => {
  if (matches.length > 1) {
    throw new Error(
      `Subspace ${resource} identity collision for oid ${expected.oid} and id ${expected.id}`
    );
  }

  let match = matches[0];
  if (match && (match.oid !== expected.oid || match.id !== expected.id)) {
    throw new Error(
      `Subspace ${resource} identity mismatch: expected ${expected.id}/${expected.oid}, found ${match.id}/${match.oid}`
    );
  }
};

export let upsertOrganizationMirror = async (organization: MetorialOrganization) => {
  let matches = await subspaceDb.organization.findMany({
    where: {
      OR: [{ oid: organization.oid }, { id: organization.id }]
    },
    select: { oid: true, id: true }
  });
  assertMirrorIdentity('organization', organization, matches);

  return await subspaceDb.organization.upsert({
    where: { oid: organization.oid },
    update: {
      type: organization.type,
      status: organization.status,
      slug: organization.slug,
      name: organization.name,
      image: organization.image,
      deletedAt: organization.deletedAt,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt
    },
    create: {
      oid: organization.oid,
      id: organization.id,
      type: organization.type,
      status: organization.status,
      slug: organization.slug,
      name: organization.name,
      image: organization.image,
      deletedAt: organization.deletedAt,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt
    }
  });
};

export let upsertProjectMirror = async (d: {
  project: MetorialProject;
  tenantOid: bigint;
}) => {
  let matches = await subspaceDb.project.findMany({
    where: {
      OR: [{ oid: d.project.oid }, { id: d.project.id }]
    },
    select: { oid: true, id: true }
  });
  assertMirrorIdentity('project', d.project, matches);

  return await subspaceDb.project.upsert({
    where: { oid: d.project.oid },
    update: {
      status: d.project.status,
      slug: d.project.slug,
      name: d.project.name,
      organizationOid: d.project.organizationOid,
      tenantOid: d.tenantOid,
      deletedAt: d.project.deletedAt,
      createdAt: d.project.createdAt,
      updatedAt: d.project.updatedAt
    },
    create: {
      oid: d.project.oid,
      id: d.project.id,
      status: d.project.status,
      slug: d.project.slug,
      name: d.project.name,
      organizationOid: d.project.organizationOid,
      tenantOid: d.tenantOid,
      deletedAt: d.project.deletedAt,
      createdAt: d.project.createdAt,
      updatedAt: d.project.updatedAt
    }
  });
};

export let upsertInstanceMirror = async (d: {
  instance: MetorialInstance;
  environmentOid: bigint;
}) => {
  let matches = await subspaceDb.instance.findMany({
    where: {
      OR: [{ oid: d.instance.oid }, { id: d.instance.id }]
    },
    select: { oid: true, id: true }
  });
  assertMirrorIdentity('instance', d.instance, matches);

  return await subspaceDb.instance.upsert({
    where: { oid: d.instance.oid },
    update: {
      type: d.instance.type,
      status: d.instance.status,
      slug: d.instance.slug,
      name: d.instance.name,
      projectOid: d.instance.projectOid,
      organizationOid: d.instance.organizationOid,
      environmentOid: d.environmentOid,
      deletedAt: d.instance.deletedAt,
      createdAt: d.instance.createdAt,
      updatedAt: d.instance.updatedAt
    },
    create: {
      oid: d.instance.oid,
      id: d.instance.id,
      type: d.instance.type,
      status: d.instance.status,
      slug: d.instance.slug,
      name: d.instance.name,
      projectOid: d.instance.projectOid,
      organizationOid: d.instance.organizationOid,
      environmentOid: d.environmentOid,
      deletedAt: d.instance.deletedAt,
      createdAt: d.instance.createdAt,
      updatedAt: d.instance.updatedAt
    }
  });
};

export let upsertOrganizationActorMirror = async (
  organizationActor: MetorialOrganizationActor
) => {
  let matches = await subspaceDb.organizationActor.findMany({
    where: {
      OR: [{ oid: organizationActor.oid }, { id: organizationActor.id }]
    },
    select: { oid: true, id: true }
  });
  assertMirrorIdentity('organization actor', organizationActor, matches);

  return await subspaceDb.organizationActor.upsert({
    where: { oid: organizationActor.oid },
    update: {
      type: organizationActor.type,
      isSystem: organizationActor.isSystem,
      email: organizationActor.email,
      name: organizationActor.name,
      image: organizationActor.image,
      organizationOid: organizationActor.organizationOid,
      createdAt: organizationActor.createdAt,
      updatedAt: organizationActor.updatedAt
    },
    create: {
      oid: organizationActor.oid,
      id: organizationActor.id,
      type: organizationActor.type,
      isSystem: organizationActor.isSystem,
      email: organizationActor.email,
      name: organizationActor.name,
      image: organizationActor.image,
      organizationOid: organizationActor.organizationOid,
      createdAt: organizationActor.createdAt,
      updatedAt: organizationActor.updatedAt
    }
  });
};

/**
 * Tenant.projectOid and Environment.instanceOid carry no foreign key, so they can be written
 * before the mirror rows exist. Everything scoped by them (sessions, providers, ...) does have a
 * foreign key, so the mirror row has to exist before the reference is handed out.
 */
export let ensureProjectMirror = async (d: {
  projectOid: bigint;
  tenantOid: bigint;
}): Promise<bigint | null> => {
  let existing = await subspaceDb.project.findUnique({
    where: { oid: d.projectOid },
    select: { oid: true, tenantOid: true }
  });
  if (existing) {
    if (existing.tenantOid !== d.tenantOid) {
      await subspaceDb.project.update({
        where: { oid: existing.oid },
        data: { tenantOid: d.tenantOid }
      });
    }
    return existing.oid;
  }

  let project = await metorialDb.project.findUnique({ where: { oid: d.projectOid } });
  if (!project) return null;

  let organization = await metorialDb.organization.findUnique({
    where: { oid: project.organizationOid }
  });
  if (!organization) return null;

  await upsertOrganizationMirror(organization);
  return (await upsertProjectMirror({ project, tenantOid: d.tenantOid })).oid;
};

export let ensureInstanceMirror = async (d: {
  instanceOid: bigint;
  environmentOid: bigint;
  tenantOid: bigint;
}): Promise<{ oid: bigint; projectOid: bigint } | null> => {
  let existing = await subspaceDb.instance.findUnique({
    where: { oid: d.instanceOid },
    select: { oid: true, projectOid: true, environmentOid: true }
  });
  if (existing) {
    if (existing.environmentOid !== d.environmentOid) {
      await subspaceDb.instance.update({
        where: { oid: existing.oid },
        data: { environmentOid: d.environmentOid }
      });
    }
    return { oid: existing.oid, projectOid: existing.projectOid };
  }

  let instance = await metorialDb.instance.findUnique({ where: { oid: d.instanceOid } });
  if (!instance) return null;

  let projectOid = await ensureProjectMirror({
    projectOid: instance.projectOid,
    tenantOid: d.tenantOid
  });
  if (projectOid === null) return null;

  let mirrored = await upsertInstanceMirror({ instance, environmentOid: d.environmentOid });
  return { oid: mirrored.oid, projectOid: mirrored.projectOid };
};

export let ensureOrganizationActorMirror = async (d: {
  organizationActorOid: bigint;
}): Promise<bigint | null> => {
  let existing = await subspaceDb.organizationActor.findUnique({
    where: { oid: d.organizationActorOid },
    select: { oid: true }
  });
  if (existing) return existing.oid;

  let organizationActor = await metorialDb.organizationActor.findUnique({
    where: { oid: d.organizationActorOid }
  });
  if (!organizationActor) return null;

  let organization = await metorialDb.organization.findUnique({
    where: { oid: organizationActor.organizationOid }
  });
  if (!organization) return null;

  await upsertOrganizationMirror(organization);
  return (await upsertOrganizationActorMirror(organizationActor)).oid;
};

export let linkTenantToProjectMirror = async (d: {
  tenant: { oid: bigint; projectOid: bigint | null };
  projectOid: bigint;
}) => {
  let projectOid = await ensureProjectMirror({
    projectOid: d.projectOid,
    tenantOid: d.tenant.oid
  });
  if (projectOid === null) {
    throw new Error(
      `Cannot link tenant ${d.tenant.oid} to project ${d.projectOid}: the project mirror could not be created`
    );
  }
  if (projectOid === d.tenant.projectOid) return projectOid;

  await subspaceDb.tenant.update({
    where: { oid: d.tenant.oid },
    data: { projectOid }
  });

  return projectOid;
};

export let linkEnvironmentToInstanceMirror = async (d: {
  environment: {
    oid: bigint;
    tenantOid: bigint;
    instanceOid: bigint | null;
    projectOid?: bigint | null;
  };
  instanceOid: bigint;
}) => {
  let instance = await ensureInstanceMirror({
    instanceOid: d.instanceOid,
    environmentOid: d.environment.oid,
    tenantOid: d.environment.tenantOid
  });
  if (instance === null) {
    throw new Error(
      `Cannot link environment ${d.environment.oid} to instance ${d.instanceOid}: the instance mirror could not be created`
    );
  }

  if (
    instance.oid === d.environment.instanceOid &&
    instance.projectOid === d.environment.projectOid
  ) {
    return instance.oid;
  }

  await subspaceDb.environment.update({
    where: { oid: d.environment.oid },
    data: {
      instanceOid: instance.oid,
      projectOid: instance.projectOid
    }
  });

  return instance.oid;
};
