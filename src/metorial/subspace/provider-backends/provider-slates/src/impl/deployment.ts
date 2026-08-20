import { db, snowflake, withTransaction } from '@metorial-subspace/db';
import {
  IProviderDeployment,
  type ProviderConfigCreateParam,
  type ProviderConfigCreateRes,
  type ProviderConfigDeleteParam,
  type ProviderConfigDeleteRes,
  type ProviderConfigUpdateParam,
  type ProviderConfigUpdateRes,
  type ProviderDeploymentCreateParam,
  type ProviderDeploymentCreateRes,
  type ProviderDeploymentDeleteParam,
  type ProviderDeploymentDeleteRes
} from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';
import { buildSlateProviderConfigUpdateRequest } from './configUpdate';

export class ProviderDeployment extends IProviderDeployment {
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
          lockedSlateVersionOid: lockedVersion?.slateVersion?.oid
        }
      });

      return { slateInstance };
    });
  }

  override async deleteProviderConfig(
    data: ProviderConfigDeleteParam
  ): Promise<ProviderConfigDeleteRes> {
    if (!data.backing.slateInstanceOid) {
      return {};
    }

    let tenant = await getTenantForSlates(data.tenant);
    let slateInstance = await db.slateInstance.findUnique({
      where: { oid: data.backing.slateInstanceOid }
    });
    if (!slateInstance) {
      return {};
    }

    await slates.slateInstance.delete({
      tenantId: tenant.id,
      slateInstanceId: slateInstance.id
    });

    return {};
  }

  override async updateProviderConfig(
    data: ProviderConfigUpdateParam
  ): Promise<ProviderConfigUpdateRes> {
    if (!data.backing.slateInstanceOid) {
      throw new Error('Provider config does not have a Slate instance backing');
    }

    let slateInstance = await db.slateInstance.findFirst({
      where: {
        oid: data.backing.slateInstanceOid,
        tenantOid: data.tenant.oid
      }
    });
    if (!slateInstance) {
      throw new Error('Provider config Slate instance backing was not found for this tenant');
    }

    let tenant = await getTenantForSlates(data.tenant);
    let updated = await slates.slateInstance.updateConfig(
      buildSlateProviderConfigUpdateRequest({
        tenantId: tenant.id,
        slateInstanceId: slateInstance.id,
        patch: data.patch,
        expectedGeneration: data.expectedGeneration
      })
    );

    return { configGeneration: updated.configGeneration };
  }
}
