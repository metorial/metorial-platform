import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createSubspaceControllerClient } from '@metorial-platform-systems/subspace-client';
import { db, Organization, OrganizationActor, Project, type Instance } from '@metorial/db';
import { env } from './env';

let solutionProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof subspace.solution.upsert>>
>();

export let getSolution = () => solutionProm.promise;

export let subspace: ReturnType<typeof createSubspaceControllerClient> =
  createSubspaceControllerClient({
    getHeaders: async () => ({
      'Subspace-Solution-Id': (await solutionProm.promise).id
    }),
    endpoint: env.subspace.SUBSPACE_URL
  });

(async () => {
  let client = createSubspaceControllerClient({
    endpoint: env.subspace.SUBSPACE_URL
  });

  let retryDelay = 500;

  while (true) {
    try {
      let sol = await client.solution.upsert({
        name: 'Metorial Platform',
        identifier: env.subspace.SUBSPACE_SOLUTION
      });
      solutionProm.resolve(sol);
      return;
    } catch (err) {
      console.log('Failed to create subspace solution ... retrying', err);
    }

    await delay(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 5000);
  }
})();

let getSubspaceTenantIdentifier = (project: Project) => `mte-pro-${project.oid}`;
let getSubspaceEnvironmentIdentifier = (instance: Instance) => `mte-ins-${instance.oid}`;

let needsSubspaceSync = (
  instance: Instance & { organization?: Organization; project?: Project }
) => {
  return (
    !instance.subspaceTenantId ||
    !instance.subspaceEnvironmentId ||
    (instance.organization && !instance.organization.subspaceTenantIds.length) ||
    !instance.lastSubspaceSyncAt ||
    Date.now() - instance.lastSubspaceSyncAt.getTime() > 1000 * 60 * 60 * 24
  );
};

export let getTenantForSubspace = async (
  instance: Instance & { organization?: Organization; project?: Project }
) => {
  let solution = await solutionProm.promise;

  if (needsSubspaceSync(instance)) {
    let currentInstance = await db.instance.findUniqueOrThrow({
      where: { oid: instance.oid },
      include: {
        organization: true,
        project: { include: { instances: true } }
      }
    });

    let subspaceTenant = await syncSubspaceTenantForProject(currentInstance.project, {
      subspaceTenantIdentifier: currentInstance.subspaceTenantIdentifier,
      await: false
    });

    let subspaceEnvironment = await subspace.environment.upsert({
      tenantId: subspaceTenant.id,
      name: currentInstance.name,
      type: currentInstance.type,
      identifier:
        currentInstance.subspaceEnvironmentIdentifier ??
        getSubspaceEnvironmentIdentifier(currentInstance)
    });

    instance = await db.$transaction(async db => {
      instance = await db.instance.update({
        where: { oid: currentInstance.oid },
        data: {
          subspaceTenantId: subspaceTenant.id,
          subspaceTenantIdentifier: subspaceTenant.identifier,
          subspaceEnvironmentId: subspaceEnvironment.id,
          subspaceEnvironmentIdentifier: subspaceEnvironment.identifier,
          lastSubspaceSyncAt: new Date()
        }
      });

      await db.project.updateMany({
        where: { oid: currentInstance.projectOid },
        data: {
          subspaceTenantId: subspaceTenant.id,
          subspaceTenantIdentifier: subspaceTenant.identifier
        }
      });

      await db.organization.updateMany({
        where: { oid: currentInstance.organizationOid },
        data: {
          subspaceTenantIds: { push: subspaceTenant.id }
        }
      });

      return instance;
    });
  }

  return {
    tenant: {
      id: instance.subspaceTenantId!,
      identifier: instance.subspaceTenantIdentifier!
    },
    solution,
    environmentId: instance.subspaceEnvironmentId!,
    environmentIdentifier: instance.subspaceEnvironmentIdentifier!
  };
};

export let getActorForSubspace = async (
  tenant: { id: string; identifier: string },
  organizationActor: OrganizationActor
) => {
  return await subspace.actor.upsert({
    tenantId: tenant.id,
    identifier: `mte-oac-${organizationActor.id}`,
    name: organizationActor.name,
    organizationActorId: organizationActor.id,
    type: 'external'
  });
};

export let syncSubspaceTenantForProject = async (
  project: Project,
  opts?: {
    subspaceTenantIdentifier?: string | null;
    await?: boolean;
  }
) => {
  let instances = await db.instance.findMany({
    where: { projectOid: project.oid },
    include: { project: true }
  });

  let tenantIdentifier =
    opts?.subspaceTenantIdentifier ??
    project.subspaceTenantIdentifier ??
    getSubspaceTenantIdentifier(project);

  let tenant = await subspace.tenant.upsert({
    identifier: tenantIdentifier,
    name: project.name,
    onlyAllowTrustedProviders: project.onlyAllowTrustedProviders,
    environments: instances.map(instance => ({
      identifier:
        instance.subspaceEnvironmentIdentifier ?? getSubspaceEnvironmentIdentifier(instance),
      name: instance.name,
      type: instance.type
    }))
  });

  let projectPromise = db.project.updateMany({
    where: { oid: project.oid },
    data: {
      subspaceTenantId: tenant.id,
      subspaceTenantIdentifier: tenant.identifier
    }
  });

  if (opts?.await) {
    await projectPromise;
  } else {
    projectPromise.catch(err => {
      console.log('Failed to update project with subspace tenant id', err);
    });
  }

  return tenant;
};
