import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { createSubspaceControllerClient } from '@metorial-services/subspace-client';
import { db, OrganizationActor, type Instance, type Organization } from '@metorial/db';
import { delay } from '@metorial/delay';
import { env } from './env';

let solutionProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof subspace.solution.upsert>>
>();

export let subspace = createSubspaceControllerClient({
  getHeaders: async () => ({
    'Subspace-Solution-Id': (await solutionProm.promise).id
  }),
  endpoint: env.subspace.SUBSPACE_URL
});

(async () => {
  while (true) {
    try {
      console.log('Trying to create subspace solution');
      let sol = await subspace.solution.upsert({
        name: 'Metorial Platform',
        identifier: env.subspace.SUBSPACE_SOLUTION
      });
      solutionProm.resolve(sol);
      return;
    } catch (err) {
      console.log('Failed to create subspace solution ... retrying', err);
    }

    await delay(5000);
  }
})();

export let getTenantForSubspace = async (organization: Organization, instance: Instance) => {
  if (!instance.subspaceTenantId || !instance.subspaceEnvironmentId) {
    let orgInstances = await db.instance.findMany({
      where: { organizationOid: organization.oid }
    });

    let subspaceTenant = await subspace.tenant.upsert({
      identifier: `mteo-${organization.id}`,
      name: organization.name,
      environments: orgInstances.map(i => ({
        identifier: `mtei-${i.id}`,
        name: i.name,
        type: i.type
      }))
    });

    let subspaceEnvironment = await subspace.environment.upsert({
      tenantId: subspaceTenant.id,
      identifier: `mtei-${instance.id}`,
      name: instance.name,
      type: instance.type
    });

    instance = await db.instance.update({
      where: { oid: instance.oid },
      data: {
        subspaceTenantId: subspaceTenant.id,
        subspaceTenantIdentifier: subspaceTenant.identifier,

        subspaceEnvironmentId: subspaceEnvironment.id,
        subspaceEnvironmentIdentifier: subspaceEnvironment.identifier
      }
    });

    organization = await db.organization.update({
      where: { oid: organization.oid },
      data: {
        subspaceTenantId: subspaceTenant.id,
        subspaceTenantIdentifier: subspaceTenant.identifier
      }
    });
  }

  return {
    tenant: {
      id: instance.subspaceTenantId!,
      identifier: instance.subspaceTenantIdentifier!
    },
    environment: {
      id: instance.subspaceEnvironmentId!,
      identifier: instance.subspaceEnvironmentIdentifier!
    }
  };
};

export let getActorForSubspace = async (
  tenant: Awaited<ReturnType<typeof getTenantForSubspace>>['tenant'],
  organizationActor: OrganizationActor
) => {
  return await subspace.actor.upsert({
    tenantId: tenant.id,
    identifier: `mtea-${organizationActor.id}`,
    name: organizationActor.name,
    organizationActorId: organizationActor.id,
    type: 'external'
  });
};
