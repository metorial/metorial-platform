import { delay } from '@lowerdeck/delay';
import { createOriginClient } from '@metorial-services/origin-client';
import { db, type Tenant } from '@metorial-subspace/db';
import { env } from './env';

export let origin = createOriginClient({
  endpoint: env.origin.ORIGIN_URL
});

(async () => {
  while (true) {
    console.log('Attempting to connect to Origin...');
    try {
      await origin.tenant.upsert({
        identifier: 'subspace-test',
        name: 'Subspace TEST'
      });
      console.log('Successfully connected to Origin');
      return;
    } catch (error) {
      console.error('Failed to connect to Origin, retrying in 5 seconds...', error);
    }

    delay(5000);
  }
})();

export let getTenantForOrigin = async (tenant: Tenant) => {
  if (!tenant.originTenantId) {
    let originTenant = await origin.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });

    tenant = await db.tenant.update({
      where: { oid: tenant.oid },
      data: {
        originTenantId: originTenant.id,
        originTenantIdentifier: originTenant.identifier
      }
    });
  }

  return {
    id: tenant.originTenantId!,
    identifier: tenant.originTenantIdentifier!
  };
};

export type ScmConnection = Awaited<ReturnType<typeof origin.scmInstallation.get>>;
export type ScmProvider = Awaited<ReturnType<typeof origin.scmBackend.get>>;
export type ScmProviderSetupSession = Awaited<
  ReturnType<typeof origin.scmBackendSetupSession.get>
>;
export type ScmConnectionSetupSession = Awaited<
  ReturnType<typeof origin.scmInstallationSession.get>
>;
export type ScmAccountPreview = Awaited<
  ReturnType<typeof origin.scmRepository.listAccountPreviews>
>['accounts'][0];
export type ScmRepositoryPreview = Awaited<
  ReturnType<typeof origin.scmRepository.listRepositoryPreviews>
>['repositories'][0];
