import { db, getId } from '@metorial-subspace/db';
import {
  IProviderEnclaveInstanceConfiguration,
  type ProviderEnclaveInstanceConfigurationSyncParam
} from '@metorial-subspace/provider-utils';
import { getTenantForShuttle, shuttle } from '../client';

export class ProviderEnclaveInstanceConfiguration extends IProviderEnclaveInstanceConfiguration {
  override async syncEnclaveInstanceConfiguration(
    data: ProviderEnclaveInstanceConfigurationSyncParam
  ): Promise<void> {
    let providerDeployment = await db.providerDeployment.findUniqueOrThrow({
      where: { oid: data.providerDeployment.oid },
      include: { serverInstanceConfiguration: true }
    });
    let tenant = await getTenantForShuttle(data.tenant);

    let configuration = await shuttle.serverInstanceConfiguration.upsert({
      tenantId: tenant.id,
      serverInstanceConfigurationId: providerDeployment.serverInstanceConfiguration?.id,
      enclaveId: data.enclaveId,
      egressPolicy: data.egressPolicy
    });

    let link =
      providerDeployment.serverInstanceConfiguration ??
      (await db.serverInstanceConfiguration.upsert({
        where: { id: configuration.id },
        update: {},
        create: {
          ...getId('serverInstanceConfiguration'),
          id: configuration.id,
          tenantOid: data.providerDeployment.tenantOid,
          environmentOid: data.providerDeployment.environmentOid
        }
      }));

    if (!providerDeployment.serverInstanceConfigurationOid) {
      await db.providerDeployment.updateMany({
        where: { oid: providerDeployment.oid },
        data: { serverInstanceConfigurationOid: link.oid }
      });
    }
  }
}
