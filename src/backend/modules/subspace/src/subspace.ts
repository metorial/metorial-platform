import { createSubspaceControllerClient } from '@metorial-services/subspace-client';
import { db, Instance } from '@metorial/db';
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

export let getTenantForSubspace = async (instance: Instance) => {
  if (!instance.subspaceTenantId) {
    let subspaceTenant = await subspace.tenant.upsert({
      identifier: `mte-${instance.id}`,
      name: instance.name
    });

    instance = await db.instance.update({
      where: { oid: instance.oid },
      data: {
        subspaceTenantId: subspaceTenant.id,
        subspaceTenantIdentifier: subspaceTenant.identifier
      }
    });
  }

  return {
    id: instance.subspaceTenantId!,
    identifier: instance.subspaceTenantIdentifier!
  };
};
