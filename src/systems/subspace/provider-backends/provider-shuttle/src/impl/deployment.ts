import { ServiceError, badRequestError } from '@lowerdeck/error';
import { db, snowflake, withTransaction } from '@metorial-subspace/db';
import {
  IProviderDeployment,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderConfigDeleteParam,
  type ProviderConfigDeleteRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes,
  type ProviderDeploymentDeleteParam,
  type ProviderDeploymentDeleteRes,
  type ValidateNetworkingRulesetIdsParam,
  type ValidateNetworkingRulesetIdsRes
} from '@metorial-subspace/provider-utils';
import { getTenantForShuttle, shuttle } from '../client';

export class ProviderDeployment extends IProviderDeployment {
  override async validateNetworkingRulesetIds(
    data: ValidateNetworkingRulesetIdsParam
  ): Promise<ValidateNetworkingRulesetIdsRes> {
    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServer = await db.shuttleServer.findFirst({
      where: { providerVersions: { some: { providerOid: data.provider.oid } } }
    });
    if (shuttleServer?.type !== 'container') {
      throw new ServiceError(
        badRequestError({
          message: 'Networking rulesets cannot be assigned to this provider type'
        })
      );
    }

    try {
      let uniqueIds = Array.from(new Set(data.networkingRulesetIds));
      let res = await shuttle.networkingRuleset.getMany({
        tenantId: tenant.id,
        networkingRulesetIds: uniqueIds
      });

      if (res.length !== uniqueIds.length) {
        throw new Error('One or more networking ruleset IDs are invalid');
      }
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'One or more networking ruleset IDs are invalid'
        })
      );
    }

    return {};
  }

  override async createProviderDeployment(
    _data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes> {
    return {};
  }

  override async deleteProviderDeployment(
    _data: ProviderDeploymentDeleteParam
  ): Promise<ProviderDeploymentDeleteRes> {
    return {};
  }

  override async createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes> {
    return withTransaction(async db => {
      if (!data.providerVariant.shuttleServerOid) {
        throw new Error('Provider variant does not have a shuttleServer associated with it');
      }

      let shuttleServer = await db.shuttleServer.findUniqueOrThrow({
        where: { oid: data.providerVariant.shuttleServerOid }
      });

      let tenant = await getTenantForShuttle(data.tenant);
      let res = await shuttle.serverConfig.create({
        tenantId: tenant.id,
        serverId: shuttleServer.id,
        config: data.config
      });

      let shuttleServerConfig = await db.shuttleServerConfig.create({
        data: {
          oid: snowflake.nextId(),
          id: res.id,

          shuttleServerOid: shuttleServer.oid,
          tenantOid: data.tenant.oid
        }
      });

      return { shuttleServerConfig };
    });
  }

  override async deleteProviderConfig(
    data: ProviderConfigDeleteParam
  ): Promise<ProviderConfigDeleteRes> {
    if (!data.backing.shuttleConfigOid) {
      return {};
    }

    let tenant = await getTenantForShuttle(data.tenant);
    let shuttleServerConfig = await db.shuttleServerConfig.findUnique({
      where: { oid: data.backing.shuttleConfigOid }
    });
    if (!shuttleServerConfig) {
      return {};
    }

    await shuttle.serverConfig.delete({
      tenantId: tenant.id,
      serverConfigId: shuttleServerConfig.id
    });

    return {};
  }
}
