import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { Service } from '@lowerdeck/service';
import {
  ID,
  type Instance,
  type Organization,
  type OrganizationActor,
  type Prisma,
  type Project
} from '@metorial/db';
import {
  db as subspaceDb,
  type Environment,
  type Solution,
  type Tenant,
  type TenantActor
} from '@metorial-subspace/db';
import { env } from '../env';
import { metorialDb } from '../lib/metorialDb';
import {
  getInstanceInternalEnvironmentIdentifier,
  getOrganizationActorInternalActorIdentifier,
  getProjectInternalTenantIdentifier
} from '../lib/scopeIds';
import { actorService } from './actor';
import { environmentService } from './environment';
import { solutionService } from './solution';
import { tenantService } from './tenant';

type ScopeProject = Pick<Project, 'id'> &
  Partial<Project> & {
    instances?: Instance[];
  };

type LoadedProject = Project & {
  instances?: Instance[];
};

type ScopeInstance = Pick<Instance, 'id'> &
  Partial<Instance> & {
    project?: ScopeProject;
    organization?: Organization;
  };

type LoadedInstance = Instance & {
  project?: LoadedProject;
  organization?: Organization;
};

export type SubspaceInstanceScope = {
  tenant: Tenant;
  environment: Environment;
  solution: Solution;
  tenantIdentifier: string;
  environmentIdentifier: string;
};

let hasUpdates = (update: Record<string, unknown>) =>
  Object.values(update).some(value => value !== undefined);

let solutionProm = new ProgrammablePromise<Solution>();
let solutionBootStarted = false;

let isCanonicalProjectIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith('mte-pro-') ?? false;

let isCanonicalEnvironmentIdentifier = (identifier: string | null | undefined) =>
  identifier?.startsWith('mte-ins-') ?? false;

let ensureSolutionBoot = () => {
  if (solutionBootStarted) return;
  solutionBootStarted = true;

  (async () => {
    let retryDelay = 500;
    while (true) {
      try {
        let solution = await solutionService.upsertSolution({
          input: {
            name: 'Metorial Platform',
            identifier: env.service.SUBSPACE_SOLUTION
          }
        });
        solutionProm.resolve(solution);
        return;
      } catch (error) {
        console.log('Failed to create subspace solution ... retrying', error);
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, 5000);
    }
  })();
};

let getProjectTenantIdentifier = (project: ScopeProject) => {
  if (project.oid == null) throw new Error(`Project ${project.id} is missing oid`);

  let expected = getProjectInternalTenantIdentifier({ oid: project.oid });
  if (
    isCanonicalProjectIdentifier(project.internalTenantIdentifier) &&
    project.internalTenantIdentifier !== expected
  ) {
    throw new Error(
      `Project ${project.id} has canonical tenant identifier ${project.internalTenantIdentifier}, expected ${expected}`
    );
  }

  return expected;
};

let getInstanceEnvironmentIdentifier = (instance: ScopeInstance) => {
  if (instance.oid == null) throw new Error(`Instance ${instance.id} is missing oid`);

  let expected = getInstanceInternalEnvironmentIdentifier({ oid: instance.oid });
  if (
    isCanonicalEnvironmentIdentifier(instance.internalEnvironmentIdentifier) &&
    instance.internalEnvironmentIdentifier !== expected
  ) {
    throw new Error(
      `Instance ${instance.id} has canonical environment identifier ${instance.internalEnvironmentIdentifier}, expected ${expected}`
    );
  }

  return expected;
};

let getOrganizationActorIdentifier = (
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) =>
  organizationActor.internalActorIdentifier ??
  getOrganizationActorInternalActorIdentifier(organizationActor);

let loadProjectWithInstances = async (project: ScopeProject): Promise<LoadedProject> => {
  if (
    project.instances &&
    project.name &&
    project.oid != null &&
    project.onlyAllowTrustedProviders != null
  ) {
    return project as LoadedProject;
  }

  return await metorialDb.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { instances: true }
  });
};

let loadInstanceWithSubspaceContext = async (
  instance: ScopeInstance
): Promise<LoadedInstance> => {
  if (
    instance.project?.instances &&
    instance.organization &&
    instance.name &&
    instance.type &&
    instance.oid != null &&
    instance.project.name &&
    instance.project.oid != null
  ) {
    return instance as LoadedInstance;
  }

  return await metorialDb.instance.findUniqueOrThrow({
    where: { id: instance.id },
    include: {
      project: { include: { instances: true } },
      organization: true
    }
  });
};

let assertCanonicalProjectScope = async (project: LoadedProject) => {
  if (!isCanonicalProjectIdentifier(project.internalTenantIdentifier)) return;

  let expectedIdentifier = getProjectTenantIdentifier(project);
  if (!project.subspaceTenantId) {
    throw new Error(
      `Project ${project.id} has canonical tenant identifier but no subspace tenant id`
    );
  }

  let tenant = await subspaceDb.tenant.findUnique({
    where: { id: project.subspaceTenantId },
    select: { identifier: true }
  });
  if (tenant?.identifier !== expectedIdentifier) {
    throw new Error(
      `Project ${project.id} canonical tenant link does not resolve to ${expectedIdentifier}`
    );
  }
};

let assertCanonicalInstanceScope = async (instance: Instance, project: LoadedProject) => {
  let hasCanonicalTenant = isCanonicalProjectIdentifier(instance.internalTenantIdentifier);
  let hasCanonicalEnvironment = isCanonicalEnvironmentIdentifier(
    instance.internalEnvironmentIdentifier
  );
  if (!hasCanonicalTenant && !hasCanonicalEnvironment) return;

  let expectedTenantIdentifier = getProjectTenantIdentifier(project);
  let expectedEnvironmentIdentifier = getInstanceEnvironmentIdentifier(instance);

  if (hasCanonicalTenant) {
    if (instance.internalTenantIdentifier !== expectedTenantIdentifier) {
      throw new Error(
        `Instance ${instance.id} canonical tenant identifier does not match project ${project.id}`
      );
    }
    if (!instance.subspaceTenantId) {
      throw new Error(
        `Instance ${instance.id} has canonical tenant identifier but no subspace tenant id`
      );
    }

    let tenant = await subspaceDb.tenant.findUnique({
      where: { id: instance.subspaceTenantId },
      select: { oid: true, identifier: true }
    });
    if (tenant?.identifier !== expectedTenantIdentifier) {
      throw new Error(
        `Instance ${instance.id} canonical tenant link does not resolve to ${expectedTenantIdentifier}`
      );
    }

    if (hasCanonicalEnvironment) {
      if (!instance.subspaceEnvironmentId) {
        throw new Error(
          `Instance ${instance.id} has canonical environment identifier but no subspace environment id`
        );
      }

      let environment = await subspaceDb.environment.findUnique({
        where: { id: instance.subspaceEnvironmentId },
        select: { identifier: true, tenantOid: true }
      });
      if (
        environment?.identifier !== expectedEnvironmentIdentifier ||
        environment.tenantOid !== tenant.oid
      ) {
        throw new Error(
          `Instance ${instance.id} canonical environment link does not resolve beneath its canonical tenant`
        );
      }
    }
  } else if (hasCanonicalEnvironment) {
    throw new Error(
      `Instance ${instance.id} has a canonical environment linked to a legacy tenant`
    );
  }
};

let loadOrganizationActor = async (
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) => {
  if (organizationActor.name && organizationActor.type) {
    return organizationActor as OrganizationActor;
  }

  return await metorialDb.organizationActor.findUniqueOrThrow({
    where: { id: organizationActor.id }
  });
};

let resolveProjectResourceTenant = async (project: ScopeProject) => {
  let loadedProject = await loadProjectWithInstances(project);

  if (loadedProject.resourceTenantOid) {
    return await metorialDb.resourceTenant.findUniqueOrThrow({
      where: { oid: loadedProject.resourceTenantOid }
    });
  }

  let identifier = getProjectTenantIdentifier(loadedProject);
  let resourceTenant = await metorialDb.resourceTenant.upsert({
    where: { identifier },
    update: { name: loadedProject.name },
    create: {
      id: await ID.generateId('resourceTenant'),
      identifier,
      name: loadedProject.name
    }
  });

  await metorialDb.project.update({
    where: { id: loadedProject.id },
    data: { resourceTenantOid: resourceTenant.oid }
  });

  return resourceTenant;
};

let resolveInstanceResourceGroup = async (instance: ScopeInstance) => {
  let loadedInstance = await loadInstanceWithSubspaceContext(instance);
  let resourceTenant = await resolveProjectResourceTenant(loadedInstance.project!);

  if (loadedInstance.resourceGroupOid) {
    return await metorialDb.resourceGroup.findUniqueOrThrow({
      where: { oid: loadedInstance.resourceGroupOid }
    });
  }

  let identifier = getInstanceEnvironmentIdentifier(loadedInstance);
  let resourceGroup = await metorialDb.resourceGroup.upsert({
    where: {
      resourceTenantOid_identifier: {
        resourceTenantOid: resourceTenant.oid,
        identifier
      }
    },
    update: {
      name: loadedInstance.name,
      type: loadedInstance.type
    },
    create: {
      id: await ID.generateId('resourceGroup'),
      resourceTenantOid: resourceTenant.oid,
      identifier,
      name: loadedInstance.name,
      type: loadedInstance.type
    }
  });

  await metorialDb.instance.update({
    where: { id: loadedInstance.id },
    data: {
      resourceTenantOid: resourceTenant.oid,
      resourceGroupOid: resourceGroup.oid
    }
  });

  return resourceGroup;
};

let getProjectResourceTenantOidForSubspaceTenant = async (tenantId: string) => {
  let project = await metorialDb.project.findFirst({
    where: { subspaceTenantId: tenantId },
    select: { id: true, resourceTenantOid: true }
  });

  if (!project) {
    throw new Error(`No Metorial project is linked to subspace tenant ${tenantId}`);
  }

  if (project.resourceTenantOid) return project.resourceTenantOid;

  return (await resolveProjectResourceTenant(project)).oid;
};

let resolveOrganizationActorResourceActor = async (d: {
  tenantId: string;
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>;
}) => {
  let loadedOrganizationActor = await loadOrganizationActor(d.organizationActor);
  let resourceTenantOid = await getProjectResourceTenantOidForSubspaceTenant(d.tenantId);

  let resourceActor = await metorialDb.resourceActor.findFirst({
    where: {
      organizationActorOid: loadedOrganizationActor.oid,
      resourceTenantOid
    }
  });

  if (resourceActor) return resourceActor;

  return await metorialDb.resourceActor.create({
    data: {
      id: await ID.generateId('resourceActor'),
      resourceTenantOid,
      identifier: getOrganizationActorIdentifier(loadedOrganizationActor),
      name: loadedOrganizationActor.name,
      type: 'external',
      organizationActorOid: loadedOrganizationActor.oid
    }
  });
};

let persistProjectTenantLink = async (d: {
  project: Project;
  tenantId: string;
  tenantIdentifier: string;
}) => {
  if (isCanonicalProjectIdentifier(d.project.internalTenantIdentifier)) return d.project;

  let update: Prisma.ProjectUpdateInput = {
    internalTenantIdentifier: d.tenantIdentifier,
    subspaceTenantId: d.tenantId
  };

  if (!hasUpdates(update)) return d.project;

  return await metorialDb.project.update({
    where: { id: d.project.id },
    data: update
  });
};

let persistInstanceScope = async (d: {
  instance: Instance;
  tenantId: string;
  tenantIdentifier: string;
  environmentId: string;
  environmentIdentifier: string;
}) => {
  let canonicalTenant = isCanonicalProjectIdentifier(d.instance.internalTenantIdentifier);
  let canonicalEnvironment = isCanonicalEnvironmentIdentifier(
    d.instance.internalEnvironmentIdentifier
  );
  let update: Prisma.InstanceUpdateInput = {
    ...(canonicalTenant
      ? {}
      : {
          internalTenantIdentifier: d.tenantIdentifier,
          subspaceTenantId: d.tenantId
        }),
    ...(canonicalEnvironment
      ? {}
      : {
          internalEnvironmentIdentifier: d.environmentIdentifier,
          subspaceEnvironmentId: d.environmentId
        }),
    lastSubspaceSyncAt: new Date()
  };

  if (!hasUpdates(update)) return;

  await metorialDb.instance.update({
    where: { id: d.instance.id },
    data: update
  });
};

let persistOrganizationActorLink = async (d: {
  organizationActor: OrganizationActor;
  actorId: string;
  actorIdentifier: string;
}) => {
  let update: Prisma.OrganizationActorUpdateInput = {
    ...(d.organizationActor.internalActorIdentifier
      ? {}
      : { internalActorIdentifier: d.actorIdentifier }),
    ...(!d.organizationActor.subspaceActorId ? { subspaceActorId: d.actorId } : {})
  };

  if (!hasUpdates(update)) return;

  await metorialDb.organizationActor.update({
    where: { id: d.organizationActor.id },
    data: update
  });
};

class subspaceScopeServiceImpl {
  async getSolution() {
    ensureSolutionBoot();
    return await solutionProm.promise;
  }

  async ensureForProject(project: ScopeProject) {
    let loadedProject = await loadProjectWithInstances(project);
    await assertCanonicalProjectScope(loadedProject);
    for (let instance of loadedProject.instances ?? []) {
      await assertCanonicalInstanceScope(instance, loadedProject);
    }

    let tenantIdentifier = getProjectTenantIdentifier(loadedProject);
    let resourceTenant = await resolveProjectResourceTenant(loadedProject);

    let tenant = await tenantService.upsertTenant({
      input: {
        identifier: tenantIdentifier,
        name: loadedProject.name,
        onlyAllowTrustedProviders: loadedProject.onlyAllowTrustedProviders,
        resourceTenantId: resourceTenant.id,
        resourceTenantIdentifier: resourceTenant.identifier,
        environments: await Promise.all(
          (loadedProject.instances ?? []).map(async instance => {
            let resourceGroup = await resolveInstanceResourceGroup(instance);
            return {
              identifier: getInstanceEnvironmentIdentifier(instance),
              name: instance.name,
              type: instance.type,
              resourceGroupId: resourceGroup.id,
              resourceGroupIdentifier: resourceGroup.identifier
            };
          })
        )
      }
    });

    await persistProjectTenantLink({
      project: loadedProject,
      tenantId: tenant.id,
      tenantIdentifier
    });

    return {
      tenant,
      tenantIdentifier,
      solution: await this.getSolution()
    };
  }

  async ensureForInstance(instance: ScopeInstance): Promise<SubspaceInstanceScope> {
    let loadedInstance = await loadInstanceWithSubspaceContext(instance);
    await assertCanonicalProjectScope(loadedInstance.project!);
    await assertCanonicalInstanceScope(loadedInstance, loadedInstance.project!);

    let environmentIdentifier = getInstanceEnvironmentIdentifier(loadedInstance);
    let resourceGroup = await resolveInstanceResourceGroup(loadedInstance);
    let { tenant, tenantIdentifier, solution } = await this.ensureForProject(
      loadedInstance.project!
    );

    let environment = await environmentService.upsertEnvironment({
      tenant,
      input: {
        identifier: environmentIdentifier,
        name: loadedInstance.name,
        type: loadedInstance.type,
        resourceGroupId: resourceGroup.id,
        resourceGroupIdentifier: resourceGroup.identifier
      }
    });

    await persistInstanceScope({
      instance: loadedInstance,
      tenantId: tenant.id,
      tenantIdentifier,
      environmentId: environment.id,
      environmentIdentifier
    });

    if (!loadedInstance.organization!.subspaceTenantIds.includes(tenant.id)) {
      await metorialDb.organization.update({
        where: { id: loadedInstance.organization!.id },
        data: {
          subspaceTenantIds: {
            push: tenant.id
          }
        }
      });
    }

    return {
      tenant,
      environment,
      solution,
      tenantIdentifier,
      environmentIdentifier
    };
  }

  async ensureForOrganizationActor(d: {
    tenant: Tenant;
    organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>;
  }): Promise<TenantActor> {
    if (d.organizationActor.subspaceActorId) {
      return await actorService.getActorById({
        tenant: d.tenant,
        id: d.organizationActor.subspaceActorId
      });
    }

    let loadedOrganizationActor = await loadOrganizationActor(d.organizationActor);
    if (loadedOrganizationActor.subspaceActorId) {
      return await actorService.getActorById({
        tenant: d.tenant,
        id: loadedOrganizationActor.subspaceActorId
      });
    }

    let actorIdentifier = getOrganizationActorIdentifier(loadedOrganizationActor);
    let resourceActor = await resolveOrganizationActorResourceActor({
      tenantId: d.tenant.id,
      organizationActor: loadedOrganizationActor
    });

    let actor = await actorService.upsertActor({
      tenant: d.tenant,
      input: {
        identifier: actorIdentifier,
        name: loadedOrganizationActor.name,
        type: 'external',
        organizationActorId: loadedOrganizationActor.id,
        resourceActorId: resourceActor.id,
        resourceActorIdentifier: resourceActor.identifier
      }
    });

    await persistOrganizationActorLink({
      organizationActor: loadedOrganizationActor,
      actorId: actor.id,
      actorIdentifier
    });

    return actor;
  }
}

export let subspaceScopeService = Service.create(
  'subspaceScopeService',
  () => new subspaceScopeServiceImpl()
).build();
