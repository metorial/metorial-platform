import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createSubspaceControllerClient } from '@metorial-services/subspace-client';
import {
  db,
  Organization,
  OrganizationActor,
  Project,
  withTransaction,
  type Instance
} from '@metorial/db';
import { createLock } from '@metorial/lock';
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

  while (true) {
    try {
      console.log('Trying to create subspace solution');

      let sol = await client.solution.upsert({
        name: 'Metorial Platform',
        identifier: env.subspace.SUBSPACE_SOLUTION
      });
      solutionProm.resolve(sol);
      console.log('Created subspace solution: ', sol.id);
      return;
    } catch (err) {
      console.log('Failed to create subspace solution ... retrying', err);
    }

    await delay(5000);
  }
})();

let lock = createLock({
  name: 'mte/sub/up-ten'
});

let getSubspaceTenantIdentifier = (project: Project) => `mte-pro-${project.oid}`;
let getSubspaceEnvironmentIdentifier = (instance: Instance) => `mte-ins-${instance.oid}`;

export let getTenantForSubspace = async (
  instance: Instance & { organization?: Organization }
) => {
  let solution = await solutionProm.promise;

  if (
    !instance.subspaceTenantId ||
    !instance.subspaceEnvironmentId ||
    (instance.organization && !instance.organization.subspaceTenantIds.length)
  ) {
    instance = await lock.usingLock(String(instance.organizationOid), async () => {
      let currentInstance = await db.instance.findUniqueOrThrow({
        where: { oid: instance.oid },
        include: { project: { include: { instances: true } } }
      });

      let instanceTenantIdentifier =
        currentInstance.subspaceTenantIdentifier ??
        getSubspaceTenantIdentifier(currentInstance.project);
      let instanceEnvironmentIdentifier =
        currentInstance.subspaceEnvironmentIdentifier ??
        getSubspaceEnvironmentIdentifier(currentInstance);

      let project = currentInstance.project;

      let subspaceTenant = await subspace.tenant.upsert({
        identifier: instanceTenantIdentifier,
        name: project.name,
        environments: currentInstance.project.instances.map(instance => ({
          identifier: getSubspaceEnvironmentIdentifier(instance),
          name: instance.name,
          type: instance.type
        }))
      });

      let subspaceEnvironment = await subspace.environment.upsert({
        tenantId: subspaceTenant.id,
        identifier: instanceEnvironmentIdentifier,
        name: instance.name,
        type: instance.type
      });

      return await withTransaction(async db => {
        instance = await db.instance.update({
          where: { oid: instance.oid },
          data: {
            subspaceTenantId: subspaceTenant.id,
            subspaceTenantIdentifier: subspaceTenant.identifier,
            subspaceEnvironmentId: subspaceEnvironment.id,
            subspaceEnvironmentIdentifier: subspaceEnvironment.identifier
          }
        });

        await db.project.update({
          where: { oid: instance.projectOid },
          data: {
            subspaceTenantId: subspaceTenant.id,
            subspaceTenantIdentifier: subspaceTenant.identifier
          }
        });

        await db.organization.update({
          where: { oid: instance.organizationOid },
          data: {
            subspaceTenantIds: {
              push: subspaceTenant.id
            }
          }
        });

        return instance;
      });
    });
  }

  return {
    tenant: {
      id: instance.subspaceTenantId!,
      identifier: instance.subspaceTenantIdentifier!
    },
    solution,
    environmentId: instance.subspaceEnvironmentId!
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
