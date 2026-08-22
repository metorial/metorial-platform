import { badRequestError, isServiceError, ServiceError } from '@lowerdeck/error';
import { db, snowflake } from '@metorial-subspace/db';
import {
  IProviderCallbackConfig,
  type CallbackConfigCreateNextParam,
  type CallbackConfigCreateParam,
  type CallbackConfigCreateRes,
  type CallbackConfigDeleteParam,
  type CallbackConfigDeleteRes,
  type CallbackConfigSchemaGetParam,
  type CallbackConfigSchemaGetRes
} from '@metorial-subspace/provider-utils';
import { getTenantForSlates, slates } from '../client';

let callbackConfigApi = (
  slates as typeof slates & {
    slateCallbackConfig: {
      getSchema(input: {
        tenantId: string;
        slateId: string;
        slateVersionId: string;
        triggerIds: string[];
      }): Promise<{ schema: Record<string, any> | null }>;
      create(input: {
        tenantId: string;
        slateId: string;
        slateVersionId: string;
        triggerIds: string[];
        values: Record<string, string>;
      }): Promise<{ id: string; configuredKeys: string[]; createdAt: Date }>;
      createNext(input: {
        tenantId: string;
        previousSlateCallbackConfigId: string;
        slateVersionId: string;
        triggerIds: string[];
        valuesPatch: Record<string, string>;
      }): Promise<{ id: string; configuredKeys: string[]; createdAt: Date }>;
      delete(input: {
        tenantId: string;
        slateCallbackConfigId: string;
      }): Promise<{ success: boolean }>;
    };
  }
).slateCallbackConfig;

let resolveSlateContext = async (data: CallbackConfigSchemaGetParam) => {
  if (!data.providerVariant.slateOid) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_slate_required',
        message: 'Provider variant does not have a Slate associated with it.'
      })
    );
  }
  if (!data.providerVersion.slateVersionOid) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_slate_version_required',
        message: 'Provider version does not have a Slate version associated with it.'
      })
    );
  }

  let slate = await db.slate.findUnique({
    where: { oid: data.providerVariant.slateOid }
  });
  if (!slate) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_slate_not_found',
        message: "Provider variant's Slate could not be found."
      })
    );
  }

  let slateVersion = await db.slateVersion.findUnique({
    where: { oid: data.providerVersion.slateVersionOid }
  });
  if (!slateVersion) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_slate_version_not_found',
        message: "Provider version's Slate version could not be found."
      })
    );
  }
  if (slateVersion.slateOid !== slate.oid) {
    throw new ServiceError(
      badRequestError({
        code: 'callback_slate_version_mismatch',
        message:
          "Provider version's Slate version does not belong to the provider variant's Slate."
      })
    );
  }

  let tenant = await getTenantForSlates(data.tenant);
  return { slate, slateVersion, tenant };
};

let createMirror = async (d: {
  data: CallbackConfigCreateParam | CallbackConfigCreateNextParam;
  slateOid: bigint;
  result: { id: string; configuredKeys: string[] };
}): Promise<CallbackConfigCreateRes> => {
  let slateCallbackConfig = await db.slateCallbackConfig.create({
    data: {
      oid: snowflake.nextId(),
      id: d.result.id,
      slateOid: d.slateOid,
      tenantOid: d.data.tenant.oid,
      projectOid: d.data.tenant.projectOid
    }
  });
  return {
    slateCallbackConfig,
    configuredKeys: d.result.configuredKeys
  };
};

export class ProviderCallbackConfig extends IProviderCallbackConfig {
  override async getCallbackConfigSchema(
    data: CallbackConfigSchemaGetParam
  ): Promise<CallbackConfigSchemaGetRes> {
    let { slate, slateVersion, tenant } = await resolveSlateContext(data);
    return await callbackConfigApi.getSchema({
      tenantId: tenant.id,
      slateId: slate.id,
      slateVersionId: slateVersion.id,
      triggerIds: data.triggerIds
    });
  }

  override async createCallbackConfig(
    data: CallbackConfigCreateParam
  ): Promise<CallbackConfigCreateRes> {
    let { slate, slateVersion, tenant } = await resolveSlateContext(data);
    let result = await callbackConfigApi.create({
      tenantId: tenant.id,
      slateId: slate.id,
      slateVersionId: slateVersion.id,
      triggerIds: data.triggerIds,
      values: data.values
    });
    return await createMirror({ data, slateOid: slate.oid, result });
  }

  override async createNextCallbackConfig(
    data: CallbackConfigCreateNextParam
  ): Promise<CallbackConfigCreateRes> {
    if (!data.previousBacking.slateCallbackConfigOid) {
      throw new Error('Previous callback config does not have a slates backing');
    }
    let previous = await db.slateCallbackConfig.findUniqueOrThrow({
      where: { oid: data.previousBacking.slateCallbackConfigOid }
    });
    let { slate, slateVersion, tenant } = await resolveSlateContext(data);
    let result = await callbackConfigApi.createNext({
      tenantId: tenant.id,
      previousSlateCallbackConfigId: previous.id,
      slateVersionId: slateVersion.id,
      triggerIds: data.triggerIds,
      valuesPatch: data.valuesPatch
    });
    return await createMirror({ data, slateOid: slate.oid, result });
  }

  override async deleteCallbackConfig(
    data: CallbackConfigDeleteParam
  ): Promise<CallbackConfigDeleteRes> {
    if (!data.backing.slateCallbackConfigOid) return {};
    let mirror = await db.slateCallbackConfig.findUnique({
      where: { oid: data.backing.slateCallbackConfigOid }
    });
    if (!mirror) return {};

    let tenant = await getTenantForSlates(data.tenant);
    try {
      await callbackConfigApi.delete({
        tenantId: tenant.id,
        slateCallbackConfigId: mirror.id
      });
    } catch (error) {
      if (!isServiceError(error) || error.data.code !== 'not_found') throw error;
    }
    return {};
  }
}
