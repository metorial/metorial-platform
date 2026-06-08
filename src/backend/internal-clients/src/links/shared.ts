import {
  db,
  type Consumer,
  type Instance,
  type Organization,
  type OrganizationActor,
  type Prisma,
  type Project,
  type User
} from '@metorial/db';
import {
  defaultInternalEnvironmentIdentifier,
  getConsumerInternalActorIdentifier,
  getInstanceInternalEnvironmentIdentifier,
  getOrganizationActorInternalActorIdentifier,
  getOrganizationInternalTenantIdentifier,
  getProjectInternalTenantIdentifier,
  getUserInternalTenantIdentifier
} from '../ids';
import type {
  InternalInstance,
  InternalProject,
  InternalScope,
  InternalService,
  LoadedInternalInstance,
  LoadedInternalProject
} from './types';

export { defaultInternalEnvironmentIdentifier };

export let hasUpdates = (update: Record<string, unknown>) =>
  Object.values(update).some(value => value !== undefined);

export let toScope = (d: InternalScope): InternalScope => d;

export let getProjectServiceTenantId = (
  service: InternalService,
  project: InternalProject
) => {
  switch (service) {
    case 'cargo':
      return project.cargoTenantId;
    case 'synthesis':
      return project.synthesisTenantId;
    case 'subspace':
      return project.subspaceTenantId;
    case 'nebula':
      return project.nebulaTenantId;
  }
};

export let getInstanceServiceTenantId = (
  service: InternalService,
  instance: InternalInstance
) => {
  switch (service) {
    case 'cargo':
      return instance.cargoTenantId;
    case 'synthesis':
      return instance.synthesisTenantId;
    case 'subspace':
      return instance.subspaceTenantId;
  }
};

export let getInstanceServiceEnvironmentId = (
  service: InternalService,
  instance: InternalInstance
) => {
  switch (service) {
    case 'cargo':
      return instance.cargoEnvironmentId;
    case 'synthesis':
      return instance.synthesisEnvironmentId;
    case 'subspace':
      return instance.subspaceEnvironmentId;
  }
};

export let getOrganizationServiceTenantId = (service: 'cargo', organization: Organization) =>
  organization.cargoTenantId;

export let getOrganizationServiceEnvironmentId = (
  service: 'cargo',
  organization: Organization
) => organization.cargoEnvironmentId;

export let getUserServiceTenantId = (service: 'cargo' | 'synthesis', user: User) =>
  service == 'cargo' ? user.cargoTenantId : user.synthesisTenantId;

export let getUserServiceEnvironmentId = (service: 'cargo' | 'synthesis', user: User) =>
  service == 'cargo' ? user.cargoEnvironmentId : user.synthesisEnvironmentId;

export let getOrganizationActorServiceId = (
  service: InternalService,
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) => {
  switch (service) {
    case 'cargo':
      return organizationActor.cargoActorId;
    case 'synthesis':
      return organizationActor.synthesisActorId;
    case 'subspace':
      return organizationActor.subspaceActorId;
  }
};

export let getConsumerServiceId = (
  service: InternalService,
  consumer: Pick<Consumer, 'id'> & Partial<Consumer>
) => {
  switch (service) {
    case 'cargo':
      return consumer.cargoActorId;
    case 'synthesis':
      return consumer.synthesisActorId;
    case 'subspace':
      return consumer.subspaceActorId;
  }
};

export let getOrganizationActorType = (organizationActor: OrganizationActor) =>
  organizationActor.type == 'system' ? 'system' : 'external';

export let loadProjectWithInstances = async (
  project: InternalProject
): Promise<LoadedInternalProject> => {
  if (
    project.instances &&
    project.name &&
    project.oid != null &&
    project.onlyAllowTrustedProviders != null
  ) {
    return project as LoadedInternalProject;
  }

  return await db.project.findUniqueOrThrow({
    where: {
      id: project.id
    },
    include: {
      instances: true
    }
  });
};

export let loadInstanceWithProject = async (
  instance: InternalInstance
): Promise<LoadedInternalInstance> => {
  if (
    instance.project &&
    instance.name &&
    instance.type &&
    instance.oid != null &&
    instance.project.name &&
    instance.project.oid != null
  ) {
    return instance as LoadedInternalInstance;
  }

  return await db.instance.findUniqueOrThrow({
    where: {
      id: instance.id
    },
    include: {
      project: true
    }
  });
};

export let loadInstanceWithSubspaceContext = async (
  instance: InternalInstance
): Promise<LoadedInternalInstance> => {
  if (
    instance.project?.instances &&
    instance.organization &&
    instance.name &&
    instance.type &&
    instance.oid != null &&
    instance.project.name &&
    instance.project.oid != null
  ) {
    return instance as LoadedInternalInstance;
  }

  return await db.instance.findUniqueOrThrow({
    where: {
      id: instance.id
    },
    include: {
      project: {
        include: {
          instances: true
        }
      },
      organization: true
    }
  });
};

export let loadOrganizationActor = async (
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) => {
  if (organizationActor.name && organizationActor.type)
    return organizationActor as OrganizationActor;

  return await db.organizationActor.findUniqueOrThrow({
    where: {
      id: organizationActor.id
    }
  });
};

export let loadConsumer = async (consumer: Pick<Consumer, 'id'> & Partial<Consumer>) => {
  if (consumer.name) return consumer as Consumer;

  return await db.consumer.findUniqueOrThrow({
    where: {
      id: consumer.id
    }
  });
};

export let persistProjectTenantLink = async (d: {
  service: InternalService;
  project: Project;
  tenantId: string;
  tenantIdentifier: string;
}) => {
  let update: Prisma.ProjectUpdateInput = {
    ...(d.project.internalTenantIdentifier
      ? {}
      : { internalTenantIdentifier: d.tenantIdentifier }),
    ...(d.service == 'cargo' && !d.project.cargoTenantId ? { cargoTenantId: d.tenantId } : {}),
    ...(d.service == 'synthesis' && !d.project.synthesisTenantId
      ? { synthesisTenantId: d.tenantId }
      : {}),
    ...(d.service == 'subspace' && !d.project.subspaceTenantId
      ? { subspaceTenantId: d.tenantId }
      : {}),
    ...(d.service == 'nebula' && !d.project.nebulaTenantId
      ? { nebulaTenantId: d.tenantId }
      : {})
  };

  if (!hasUpdates(update)) return d.project;

  return await db.project.update({
    where: {
      id: d.project.id
    },
    data: update
  });
};

export let persistOrganizationScope = async (d: {
  service: 'cargo';
  organization: Organization;
  tenantId: string;
  tenantIdentifier: string;
  environmentId: string;
}) => {
  let update: Prisma.OrganizationUpdateInput = {
    ...(d.organization.internalTenantIdentifier
      ? {}
      : { internalTenantIdentifier: d.tenantIdentifier }),
    ...(d.service == 'cargo' && !d.organization.cargoTenantId
      ? { cargoTenantId: d.tenantId }
      : {}),
    ...(d.service == 'cargo' && !d.organization.cargoEnvironmentId
      ? { cargoEnvironmentId: d.environmentId }
      : {})
  };

  if (!hasUpdates(update)) return;

  await db.organization.update({
    where: {
      id: d.organization.id
    },
    data: update
  });
};

export let persistUserScope = async (d: {
  service: 'cargo' | 'synthesis';
  user: User;
  tenantId: string;
  tenantIdentifier: string;
  environmentId: string;
}) => {
  let update: Prisma.UserUpdateInput = {
    ...(d.user.internalTenantIdentifier
      ? {}
      : { internalTenantIdentifier: d.tenantIdentifier }),
    ...(d.service == 'cargo' && !d.user.cargoTenantId ? { cargoTenantId: d.tenantId } : {}),
    ...(d.service == 'cargo' && !d.user.cargoEnvironmentId
      ? { cargoEnvironmentId: d.environmentId }
      : {}),
    ...(d.service == 'synthesis' && !d.user.synthesisTenantId
      ? { synthesisTenantId: d.tenantId }
      : {}),
    ...(d.service == 'synthesis' && !d.user.synthesisEnvironmentId
      ? { synthesisEnvironmentId: d.environmentId }
      : {})
  };

  if (!hasUpdates(update)) return;

  await db.user.update({
    where: {
      id: d.user.id
    },
    data: update
  });
};

export let persistInstanceScope = async (d: {
  service: InternalService;
  instance: Instance;
  tenantId: string;
  tenantIdentifier: string;
  environmentId: string;
  environmentIdentifier: string;
}) => {
  let update: Prisma.InstanceUpdateInput = {
    ...(d.instance.internalTenantIdentifier
      ? {}
      : { internalTenantIdentifier: d.tenantIdentifier }),
    ...(d.instance.internalEnvironmentIdentifier
      ? {}
      : { internalEnvironmentIdentifier: d.environmentIdentifier }),
    ...(d.service == 'cargo' && !d.instance.cargoTenantId
      ? { cargoTenantId: d.tenantId }
      : {}),
    ...(d.service == 'cargo' && !d.instance.cargoEnvironmentId
      ? { cargoEnvironmentId: d.environmentId }
      : {}),
    ...(d.service == 'synthesis' && !d.instance.synthesisTenantId
      ? { synthesisTenantId: d.tenantId }
      : {}),
    ...(d.service == 'synthesis' && !d.instance.synthesisEnvironmentId
      ? { synthesisEnvironmentId: d.environmentId }
      : {}),
    ...(d.service == 'subspace' && !d.instance.subspaceTenantId
      ? { subspaceTenantId: d.tenantId }
      : {}),
    ...(d.service == 'subspace' && !d.instance.subspaceEnvironmentId
      ? { subspaceEnvironmentId: d.environmentId }
      : {}),
    ...(d.service == 'subspace' && !d.instance.lastSubspaceSyncAt
      ? { lastSubspaceSyncAt: new Date() }
      : {})
  };

  if (!hasUpdates(update)) return;

  await db.instance.update({
    where: {
      id: d.instance.id
    },
    data: update
  });
};

export let persistOrganizationActorLink = async (d: {
  service: InternalService;
  organizationActor: OrganizationActor;
  actorId: string;
  actorIdentifier: string;
}) => {
  let update: Prisma.OrganizationActorUpdateInput = {
    ...(d.organizationActor.internalActorIdentifier
      ? {}
      : { internalActorIdentifier: d.actorIdentifier }),
    ...(d.service == 'cargo' && !d.organizationActor.cargoActorId
      ? { cargoActorId: d.actorId }
      : {}),
    ...(d.service == 'synthesis' && !d.organizationActor.synthesisActorId
      ? { synthesisActorId: d.actorId }
      : {}),
    ...(d.service == 'subspace' && !d.organizationActor.subspaceActorId
      ? { subspaceActorId: d.actorId }
      : {})
  };

  if (!hasUpdates(update)) return;

  await db.organizationActor.update({
    where: {
      id: d.organizationActor.id
    },
    data: update
  });
};

export let persistConsumerLink = async (d: {
  service: InternalService;
  consumer: Consumer;
  actorId: string;
  actorIdentifier: string;
}) => {
  let update: Prisma.ConsumerUpdateInput = {
    ...(d.consumer.internalActorIdentifier
      ? {}
      : { internalActorIdentifier: d.actorIdentifier }),
    ...(d.service == 'cargo' && !d.consumer.cargoActorId ? { cargoActorId: d.actorId } : {}),
    ...(d.service == 'synthesis' && !d.consumer.synthesisActorId
      ? { synthesisActorId: d.actorId }
      : {}),
    ...(d.service == 'subspace' && !d.consumer.subspaceActorId
      ? { subspaceActorId: d.actorId }
      : {})
  };

  if (!hasUpdates(update)) return;

  await db.consumer.update({
    where: {
      id: d.consumer.id
    },
    data: update
  });
};

export let getProjectTenantIdentifier = (project: InternalProject) => {
  if (project.internalTenantIdentifier) return project.internalTenantIdentifier;
  if (project.oid != null) return getProjectInternalTenantIdentifier({ oid: project.oid });

  throw new Error(`Project ${project.id} is missing oid and internalTenantIdentifier`);
};

export let getOrganizationTenantIdentifier = (organization: Organization) =>
  organization.internalTenantIdentifier ??
  getOrganizationInternalTenantIdentifier(organization);

export let getUserTenantIdentifier = (user: User) =>
  user.internalTenantIdentifier ?? getUserInternalTenantIdentifier(user);

export let getInstanceEnvironmentIdentifier = (instance: InternalInstance) => {
  if (instance.internalEnvironmentIdentifier) return instance.internalEnvironmentIdentifier;
  if (instance.oid != null)
    return getInstanceInternalEnvironmentIdentifier({ oid: instance.oid });

  throw new Error(`Instance ${instance.id} is missing oid and internalEnvironmentIdentifier`);
};

export let getInstanceTenantIdentifier = (instance: InternalInstance) => {
  if (instance.internalTenantIdentifier) return instance.internalTenantIdentifier;
  if (instance.project?.internalTenantIdentifier)
    return instance.project.internalTenantIdentifier;
  if (instance.project?.oid != null) {
    return getProjectInternalTenantIdentifier({ oid: instance.project.oid });
  }

  return null;
};

export let getOrganizationActorIdentifier = (
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) =>
  organizationActor.internalActorIdentifier ??
  getOrganizationActorInternalActorIdentifier(organizationActor);

export let getConsumerActorIdentifier = (consumer: Pick<Consumer, 'id'> & Partial<Consumer>) =>
  consumer.internalActorIdentifier ?? getConsumerInternalActorIdentifier(consumer);
