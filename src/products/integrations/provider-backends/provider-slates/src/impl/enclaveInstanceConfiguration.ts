import {
  IProviderEnclaveInstanceConfiguration,
  type ProviderEnclaveInstanceConfigurationSyncParam
} from '@metorial-subspace/provider-utils';
import { db, getId } from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '../client';

export class ProviderEnclaveInstanceConfiguration extends IProviderEnclaveInstanceConfiguration {
  override async syncEnclaveInstanceConfiguration(
    data: ProviderEnclaveInstanceConfigurationSyncParam
  ): Promise<void> {
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { oid: data.providerDeployment.oid },
      include: { slateInstanceConfiguration: true }
    });
    let tenant = await getTenantForSlates(data.tenant);

    let configuration = await slates.slateInstanceConfiguration.upsert({
      tenantId: tenant.id,
      slateInstanceConfigurationId: providerDeployment.slateInstanceConfiguration?.id,
      enclaveId: data.enclaveId,
      egressPolicy: data.egressPolicy
    });

    let link =
      providerDeployment.slateInstanceConfiguration ??
      (await db.slateInstanceConfiguration.create({
        data: {
          ...getId('slateInstanceConfiguration'),
          id: configuration.id,
          tenantOid: data.providerDeployment.tenantOid,
          projectOid: data.providerDeployment.projectOid,
          environmentOid: data.providerDeployment.environmentOid,
          instanceOid: data.providerDeployment.instanceOid
        }
      }));

    if (!providerDeployment.slateInstanceConfigurationOid) {
      await db.providerDeployment.updateMany({
        where: { oid: providerDeployment.oid },
        data: { slateInstanceConfigurationOid: link.oid }
      });
    }
  }
}
