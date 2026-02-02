import { createSubspaceControllerClient } from '@metorial-services/subspace-client';
import { db, OrganizationActor, type Instance, type Organization } from '@metorial/db';
import { env } from './env';

export let subspace = createSubspaceControllerClient({
  headers: {
    'Subspace-Solution-Id': env.subspace.SUBSPACE_SOLUTION
  },
  endpoint: env.subspace.SUBSPACE_URL
});

subspace.solution
  .upsert({
    name: 'Metorial Platform',
    identifier: env.subspace.SUBSPACE_SOLUTION
  })
  .catch(err => {
    console.error('Failed to upsert subspace solution:', err);
    process.exit(1);
  });

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
