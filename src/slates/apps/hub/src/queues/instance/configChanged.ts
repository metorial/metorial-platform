import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { slateErrorService, slateInvocationService } from '../../services';
import {
  buildConfigChangedFailureUpdate,
  configChangedJobMatches,
  mergeProviderConfigOutput,
  projectConfigChangedPayload
} from './configChangedPolicy';
import { assertCanonicalStoredSlateConfigSchema } from '../../lib/configPatch';

export type SlateInstanceConfigChangedJob = {
  previousConfigId?: string | null;
  newConfigId: string;
  versionId: string;
  configGeneration?: number;
  configSchemaHash?: string;
  previousConfig?: Record<string, unknown> | null;
  newConfig?: Record<string, unknown>;
};

export let slateInstanceConfigChangedQueue = createQueue<SlateInstanceConfigChangedJob>({
  name: 'shub/sin/cfg/chgd',
  redisUrl: env.service.REDIS_URL
});

export let processSlateInstanceConfigChanged = async (data: SlateInstanceConfigChangedJob) => {
    let previousConfig = data.previousConfigId
      ? await db.slateInstanceConfig.findUnique({
          where: { id: data.previousConfigId },
          include: {}
        })
      : null;
    let newConfig = await db.slateInstanceConfig.findUnique({
      where: { id: data.newConfigId },
      include: { instance: true, schema: true }
    });
    let version = await db.slateVersion.findUnique({
      where: { id: data.versionId },
      include: {}
    });
    if (!newConfig || !version) throw new QueueRetryError();
    if (
      !configChangedJobMatches({
        currentGeneration: newConfig.generation,
        currentSchemaHash: newConfig.schema.descriptorHash,
        configGeneration: data.configGeneration,
        configSchemaHash: data.configSchemaHash
      })
    ) {
      return;
    }

    let projectedNew = projectConfigChangedPayload({
      schemaVersion: newConfig.schema.version,
      fields: newConfig.schema.fields,
      value: newConfig.value
    });
    let projectedPrevious = previousConfig
      ? projectConfigChangedPayload({
          value: previousConfig.value,
          schemaVersion: newConfig.schema.version,
          fields: newConfig.schema.fields
        })
      : null;
    let previousConfigPayload =
      data.previousConfig === undefined
        ? projectedPrevious?.config ?? null
        : data.previousConfig === null
          ? null
          : projectConfigChangedPayload({
              value: data.previousConfig,
              schemaVersion: newConfig.schema.version,
              fields: newConfig.schema.fields
            }).config;
    let newConfigPayload =
      data.newConfig === undefined
        ? projectedNew.config
        : projectConfigChangedPayload({
            value: data.newConfig,
            schemaVersion: newConfig.schema.version,
            fields: newConfig.schema.fields
          }).config;

    let stack = await slateInvocationService.createInvocation({
      slateVersion: version,
      participants: [],
      canonicalConfigSchema:
        newConfig.schema.version === 2
          ? assertCanonicalStoredSlateConfigSchema(newConfig.schema)
          : undefined
    });
    let res = await slateInvocationService.sendUpdatedConfig({
      stack,
      previousConfig: previousConfigPayload,
      newConfig: newConfigPayload
    });
    if (res.status === 'error') {
      let failureUpdate = buildConfigChangedFailureUpdate({
        configOid: newConfig.oid,
        configGeneration: data.configGeneration,
        invocationId: res.invocation.id,
        failure: 'provider_error'
      });
      await db.slateInstanceConfig.updateMany(failureUpdate);
      slateErrorService
        .recordSlateError({
          type: 'config_validation_failed',
          errorCode: failureUpdate.data.errorCode,
          errorMessage: failureUpdate.data.errorMessage,
          tenantOid: newConfig.tenantOid,
          slateOid: newConfig.instance.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: newConfig.instance.oid,
          invocationOid: res.invocation.oid,
          instanceConfigOid: newConfig.oid
        })
        .catch(() => {});
      return;
    }
    if (!res.data.success) {
      let failureUpdate = buildConfigChangedFailureUpdate({
        configOid: newConfig.oid,
        configGeneration: data.configGeneration,
        invocationId: res.invocation.id,
        failure: 'provider_rejected'
      });
      await db.slateInstanceConfig.updateMany(failureUpdate);
      slateErrorService
        .recordSlateError({
          type: 'config_validation_failed',
          errorCode: failureUpdate.data.errorCode,
          errorMessage: failureUpdate.data.errorMessage,
          tenantOid: newConfig.tenantOid,
          slateOid: newConfig.instance.slateOid,
          slateVersionOid: version.oid,
          slateInstanceOid: newConfig.instance.oid,
          invocationOid: res.invocation.oid,
          instanceConfigOid: newConfig.oid
        })
        .catch(() => {});
      return;
    }

    let providerConfig = res.data.config ?? {};
    let merged: Record<string, unknown>;
    try {
      merged = mergeProviderConfigOutput({
        stored: newConfig.value as Record<string, unknown>,
        providerOutput: providerConfig,
        schema: newConfig.schema
      });
    } catch {
      await db.slateInstanceConfig.updateMany(
        buildConfigChangedFailureUpdate({
          configOid: newConfig.oid,
          configGeneration: data.configGeneration,
          invocationId: res.invocation.id,
          failure: 'invalid_provider_output'
        })
      );
      return;
    }
    await db.slateInstanceConfig.updateMany({
      where: {
        oid: newConfig.oid,
        ...(data.configGeneration !== undefined ? { generation: data.configGeneration } : {})
      },
      data: {
        value: merged,
        errorCode: null,
        errorMessage: null,
        errorInvocationId: null
      }
    });
};

export let slateInstanceConfigChangedQueueProcessor = slateInstanceConfigChangedQueue.process(
  processSlateInstanceConfigChanged
);
