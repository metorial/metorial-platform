import { ServiceError, badRequestError } from '@lowerdeck/error';
import { snowflake, withTransaction } from '@metorial-subspace/db';
import {
  IProviderDeployment,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes,
  type ValidateNetworkingRulesetIdsParam,
  type ValidateNetworkingRulesetIdsRes
} from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';

export class ProviderDeployment extends IProviderDeployment {
  override async validateNetworkingRulesetIds(
    data: ValidateNetworkingRulesetIdsParam
  ): Promise<ValidateNetworkingRulesetIdsRes> {
    throw new ServiceError(
      badRequestError({
        message: 'Networking rulesets cannot be assigned to this provider type'
      })
    );
  }

  override async createProviderDeployment(
    _data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes> {
    return {};
  }

  override async createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes> {
    return withTransaction(async db => {
      if (!data.providerVariant.slateOid) {
        throw new Error('Provider variant does not have a slate associated with it');
      }

      let slate = await db.slate.findUniqueOrThrow({
        where: { oid: data.providerVariant.slateOid }
      });

      let lockedVersion = data.deployment?.currentVersion?.lockedVersionOid
        ? await db.providerVersion.findUniqueOrThrow({
            where: { oid: data.deployment.currentVersion.lockedVersionOid },
            include: { slateVersion: true }
          })
        : undefined;

      let tenant = await getTenantForSlates(data.tenant);
      let res = await slates.slateInstance.create({
        tenantId: tenant.id,
        slateId: slate.id,
        config: data.config,
        lockedVersionId: lockedVersion?.slateVersion?.id
      });

      let slateInstance = await db.slateInstance.create({
        data: {
          oid: snowflake.nextId(),
          id: res.id,

          slateOid: slate.oid,
          tenantOid: data.tenant.oid,
          lockedSlateVersionOid: lockedVersion?.oid
        }
      });

      return { slateInstance };
    });
  }
}
