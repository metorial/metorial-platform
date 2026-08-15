import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { Service } from '@lowerdeck/service';
import {
  db as subspaceDb,
  type Environment,
  type Solution,
  type Tenant,
  type TenantActor
} from '@metorial-subspace/db';
import {
  ID,
  type Instance,
  type Organization,
  type OrganizationActor,
  type Prisma,
  type Project
} from '@metorial/db';
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
  if (project.internalTenantIdentifier && project.internalTenantIdentifier !== expected) {
    throw new Error(
      `Project ${project.id} has tenant identifier ${project.internalTenantIdentifier}, expected ${expected}`
    );
  }

  return expected;
};

let getInstanceEnvironmentIdentifier = (instance: ScopeInstance) => {
  if (instance.oid == null) throw new Error(`Instance ${instance.id} is missing oid`);

  let expected = getInstanceInternalEnvironmentIdentifier({ oid: instance.oid });
  if (
    instance.internalEnvironmentIdentifier &&
    instance.internalEnvironmentIdentifier !== expected
  ) {
    throw new Error(
      `Instance ${instance.id} has environment identifier ${instance.internalEnvironmentIdentifier}, expected ${expected}`
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

/**
 * Provisioning derives the tenant from the project oid and upserts on it, so a project pointing at
 * some other tenant would gain a second tenant beside the one already holding its data. Refuse
 * instead of creating that duplicate. A link to a tenant that is no longer there has nothing to
 * adopt, so provisioning a fresh one is the only way forward and is left to run.
 */
let assertProjectScope = async (project: LoadedProject) => {
  if (!project.subspaceTenantId) return;

  let expectedIdentifier = getProjectTenantIdentifier(project);
  let tenant = await subspaceDb.tenant.findUnique({
    where: { id: project.subspaceTenantId },
    select: { identifier: true }
  });
  if (!tenant || tenant.identifier === expectedIdentifier) return;

  throw new Error(
    `Project ${project.id} is linked to subspace tenant ${tenant.identifier}, not ${expectedIdentifier}`
  );
};

let assertInstanceScope = async (instance: Instance, project: LoadedProject) => {
  let expectedTenantIdentifier = getProjectTenantIdentifier(project);
  let expectedEnvironmentIdentifier = getInstanceEnvironmentIdentifier(instance);

  if (
    instance.internalTenantIdentifier &&
    instance.internalTenantIdentifier !== expectedTenantIdentifier
  ) {
    throw new Error(
      `Instance ${instance.id} carries tenant identifier ${instance.internalTenantIdentifier}, but project ${project.id} owns ${expectedTenantIdentifier}`
    );
  }

  let tenant = instance.subspaceTenantId
    ? await subspaceDb.tenant.findUnique({
        where: { id: instance.subspaceTenantId },
        select: { oid: true, identifier: true }
      })
    : null;

  if (tenant && tenant.identifier !== expectedTenantIdentifier) {
    throw new Error(
      `Instance ${instance.id} is linked to subspace tenant ${tenant.identifier}, not ${expectedTenantIdentifier}`
    );
  }

  if (!instance.subspaceEnvironmentId) return;

  let environment = await subspaceDb.environment.findUnique({
    where: { id: instance.subspaceEnvironmentId },
    select: { identifier: true, tenantOid: true }
  });
  if (!environment) return;

  if (environment.identifier !== expectedEnvironmentIdentifier) {
    throw new Error(
      `Instance ${instance.id} is linked to subspace environment ${environment.identifier}, not ${expectedEnvironmentIdentifier}`
    );
  }

  if (tenant && environment.tenantOid !== tenant.oid) {
    throw new Error(
      `Instance ${instance.id} environment ${environment.identifier} does not sit beneath tenant ${tenant.identifier}`
    );
  }
};

let loadOrganizationActor = async (
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
) => {
  if (organizationActor.name && organizationActor.type && organizationActor.oid != null) {
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
  if (
    d.project.internalTenantIdentifier === d.tenantIdentifier &&
    d.project.subspaceTenantId === d.tenantId
  ) {
    return d.project;
  }

  return await metorialDb.project.update({
    where: { id: d.project.id },
    data: {
      internalTenantIdentifier: d.tenantIdentifier,
      subspaceTenantId: d.tenantId
    }
  });
};

let persistInstanceScope = async (d: {
  instance: Instance;
  tenantId: string;
  tenantIdentifier: string;
  environmentId: string;
  environmentIdentifier: string;
}) => {
  await metorialDb.instance.update({
    where: { id: d.instance.id },
    data: {
      internalTenantIdentifier: d.tenantIdentifier,
      subspaceTenantId: d.tenantId,
      internalEnvironmentIdentifier: d.environmentIdentifier,
      subspaceEnvironmentId: d.environmentId,
      lastSubspaceSyncAt: new Date()
    }
  });
};

/**
 * The organization tracks the tenants beneath it so metorial-facing lookups can resolve an
 * organization to its subspace scope without walking every project.
 */
let trackTenantOnOrganization = async (d: { organizationOid: bigint; tenantId: string }) => {
  let organization = await metorialDb.organization.findUniqueOrThrow({
    where: { oid: d.organizationOid },
    select: { id: true, subspaceTenantIds: true }
  });
  if (organization.subspaceTenantIds.includes(d.tenantId)) return;

  await metorialDb.organization.update({
    where: { id: organization.id },
    data: { subspaceTenantIds: { push: d.tenantId } }
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
    await assertProjectScope(loadedProject);
    for (let instance of loadedProject.instances ?? []) {
      await assertInstanceScope(instance, loadedProject);
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
        projectOid: loadedProject.oid,
        skipNetworks: true,
        environments: await Promise.all(
          (loadedProject.instances ?? []).map(async instance => {
            let resourceGroup = await resolveInstanceResourceGroup(instance);
            return {
              identifier: getInstanceEnvironmentIdentifier(instance),
              name: instance.name,
              type: instance.type,
              resourceGroupId: resourceGroup.id,
              resourceGroupIdentifier: resourceGroup.identifier,
              instanceOid: instance.oid
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
    await trackTenantOnOrganization({
      organizationOid: loadedProject.organizationOid,
      tenantId: tenant.id
    });

    return {
      tenant,
      tenantIdentifier,
      solution: await this.getSolution()
    };
  }

  async ensureForInstance(instance: ScopeInstance): Promise<SubspaceInstanceScope> {
    let loadedInstance = await loadInstanceWithSubspaceContext(instance);
    await assertProjectScope(loadedInstance.project!);
    await assertInstanceScope(loadedInstance, loadedInstance.project!);

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
        resourceGroupIdentifier: resourceGroup.identifier,
        instanceOid: loadedInstance.oid
      }
    });

    await persistInstanceScope({
      instance: loadedInstance,
      tenantId: tenant.id,
      tenantIdentifier,
      environmentId: environment.id,
      environmentIdentifier
    });

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
    let loadedOrganizationActor = await loadOrganizationActor(d.organizationActor);
    let actorIdentifier = getOrganizationActorIdentifier(loadedOrganizationActor);
    let existing = await actorService.findActorForOrganizationActor({
      tenant: d.tenant,
      organizationActor: loadedOrganizationActor,
      identifier: actorIdentifier
    });

    let resourceActor = await resolveOrganizationActorResourceActor({
      tenantId: d.tenant.id,
      organizationActor: loadedOrganizationActor
    });

    let actor = await actorService.upsertActor({
      tenant: d.tenant,
      input: {
        id: existing?.id,
        identifier: actorIdentifier,
        name: loadedOrganizationActor.name,
        type: 'external',
        organizationActorId: loadedOrganizationActor.id,
        organizationActorOid: loadedOrganizationActor.oid,
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
