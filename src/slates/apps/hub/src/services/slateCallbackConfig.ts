import {
  badRequestError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Slate,
  SlateCallbackConfig,
  SlateVersion,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { validateJsonSchema } from '../lib/validateJsonSchema';
import { secretService } from './secret';
import { SlateTriggerReceiverCore } from './slateTriggerReceiverCore';
import {
  buildCallbackConfigSchemaForActions,
  type CallbackConfigJsonSchema,
  getMissingCallbackConfigKeys,
  mergeCallbackConfigValues
} from './slateCallbackConfigSchema';

export * from './slateCallbackConfigSchema';

let callbackConfigInclude = {
  secret: true,
  slate: true,
  slateVersion: true
};

let callbackConfigInvalid = (message: string) =>
  new ServiceError(
    badRequestError({
      code: 'invalid_callback_config',
      message
    })
  );

let assertSchema = (schema: CallbackConfigJsonSchema | null) => {
  if (!schema) {
    throw callbackConfigInvalid(
      'The selected triggers do not require callback configuration.'
    );
  }
  return schema;
};

let assertComplete = (schema: CallbackConfigJsonSchema, values: Record<string, string>) => {
  let missingKeys = getMissingCallbackConfigKeys(schema, values);
  if (missingKeys.length === 0) return;

  throw new ServiceError(
    badRequestError({
      code: 'callback_config_incomplete',
      message: 'The callback configuration is incomplete.',
      metadata: { missingKeys }
    })
  );
};

let validateCallbackConfig = (
  schema: CallbackConfigJsonSchema,
  values: Record<string, string>
) => {
  assertComplete(schema, values);
  try {
    return validateJsonSchema({
      schema,
      data: values,
      entity: 'callback.config',
      message: 'Invalid callback configuration.'
    }) as Record<string, string>;
  } catch (error) {
    if (!isServiceError(error)) throw error;
    throw new ServiceError(
      badRequestError({
        code: 'invalid_callback_config',
        message: 'Invalid callback configuration.',
        metadata: { errors: error.data.errors ?? [] }
      })
    );
  }
};

export let getCallbackConfigSchemaForVersion = async (d: {
  slate: Slate;
  slateVersion: SlateVersion;
  triggerIds: string[];
}): Promise<CallbackConfigJsonSchema | null> => {
  if (d.triggerIds.length === 0 || !d.slateVersion.specificationOid) {
    throw new ServiceError(
      badRequestError({
        code: 'invalid_trigger_action',
        message: 'At least one trigger action is required.'
      })
    );
  }
  if (d.slateVersion.slateOid !== d.slate.oid) {
    throw new ServiceError(notFoundError('slate.version'));
  }

  let resolved = await new SlateTriggerReceiverCore().resolveActionsForTriggers({
    slate: d.slate,
    specificationOid: d.slateVersion.specificationOid,
    triggers: d.triggerIds.map(triggerId => ({ triggerId }))
  });

  return buildCallbackConfigSchemaForActions(resolved.map(item => item.action));
};

class slateCallbackConfigServiceImpl {
  async getCallbackConfigSchemaForVersion(
    d: Parameters<typeof getCallbackConfigSchemaForVersion>[0]
  ) {
    return await getCallbackConfigSchemaForVersion(d);
  }

  async getSlateCallbackConfigById(d: { tenant: Tenant; id: string }) {
    let callbackConfig = await db.slateCallbackConfig.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.id },
      include: callbackConfigInclude
    });
    if (!callbackConfig) {
      throw new ServiceError(notFoundError('slate.callback_config'));
    }
    return callbackConfig;
  }

  async createSlateCallbackConfig(d: {
    tenant: Tenant;
    slate: Slate;
    slateVersion: SlateVersion;
    triggerIds: string[];
    values: Record<string, string>;
  }) {
    let schema = assertSchema(await getCallbackConfigSchemaForVersion(d));
    let values = validateCallbackConfig(schema, d.values);

    return await db.$transaction(async tx => {
      let secret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'slate_callback_config',
        secretData: values,
        db: tx
      });

      return await tx.slateCallbackConfig.create({
        data: {
          ...getId('slateCallbackConfig'),
          tenantOid: d.tenant.oid,
          slateOid: d.slate.oid,
          slateVersionOid: d.slateVersion.oid,
          secretOid: secret.oid,
          configuredKeys: schema.required
        },
        include: callbackConfigInclude
      });
    });
  }

  async createNextSlateCallbackConfig(d: {
    tenant: Tenant;
    previousSlateCallbackConfig: SlateCallbackConfig & {
      secret: { oid: bigint; id: string };
    };
    slate: Slate;
    slateVersion: SlateVersion;
    triggerIds: string[];
    valuesPatch: Record<string, string>;
  }) {
    if (
      d.previousSlateCallbackConfig.tenantOid !== d.tenant.oid ||
      d.previousSlateCallbackConfig.slateOid !== d.slate.oid
    ) {
      throw new ServiceError(notFoundError('slate.callback_config'));
    }

    let schema = assertSchema(await getCallbackConfigSchemaForVersion(d));
    let previousValues = await secretService.DANGEROUSLY_decryptSecret({
      tenant: d.tenant,
      secretOid: d.previousSlateCallbackConfig.secretOid,
      purpose: 'slate_callback_config',
      note: `Create next callback config version from ${d.previousSlateCallbackConfig.id}`
    });
    let values = validateCallbackConfig(
      schema,
      mergeCallbackConfigValues(schema, previousValues, d.valuesPatch)
    );

    return await db.$transaction(async tx => {
      let secret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'slate_callback_config',
        secretData: values,
        db: tx
      });

      return await tx.slateCallbackConfig.create({
        data: {
          ...getId('slateCallbackConfig'),
          tenantOid: d.tenant.oid,
          slateOid: d.slate.oid,
          slateVersionOid: d.slateVersion.oid,
          secretOid: secret.oid,
          configuredKeys: schema.required
        },
        include: callbackConfigInclude
      });
    });
  }

  async deleteSlateCallbackConfig(d: {
    tenant: Tenant;
    slateCallbackConfig: SlateCallbackConfig;
  }) {
    if (d.slateCallbackConfig.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.callback_config'));
    }

    await db.$transaction(async tx => {
      await tx.slateTriggerReceiver.updateMany({
        where: { callbackConfigOid: d.slateCallbackConfig.oid },
        data: { callbackConfigOid: null }
      });
      await secretService.DANGEROUSLY_deleteSecret({
        tenant: d.tenant,
        secretOid: d.slateCallbackConfig.secretOid,
        db: tx
      });
      await tx.slateCallbackConfig.deleteMany({
        where: { oid: d.slateCallbackConfig.oid, tenantOid: d.tenant.oid }
      });
    });
  }

  async resolveCallbackConfigValue(d: {
    tenant: Tenant;
    slateCallbackConfig: SlateCallbackConfig & { secret: { id: string; oid: bigint } };
    callbackSecretKey: string;
    note: string;
  }) {
    if (d.slateCallbackConfig.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('slate.callback_config'));
    }
    let values = await secretService.DANGEROUSLY_decryptSecret({
      tenant: d.tenant,
      secretOid: d.slateCallbackConfig.secretOid,
      purpose: 'slate_callback_config',
      note: d.note
    });
    let value = values[d.callbackSecretKey];
    if (typeof value !== 'string') return null;
    return { value, secretId: d.slateCallbackConfig.secret.id };
  }
}

export let slateCallbackConfigService = Service.create(
  'slateCallbackConfigService',
  () => new slateCallbackConfigServiceImpl()
).build();
