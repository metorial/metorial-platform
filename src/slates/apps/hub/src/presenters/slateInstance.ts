import type {
  Slate,
  SlateInstance,
  SlateInstanceConfig,
  SlateConfigSchema,
  SlateVersion
} from '../../prisma/generated/client';
import {
  parseSlateConfigFieldDescriptors,
  projectSlateConfigPresence,
  resolveStoredSlateConfigFieldDescriptors
} from '../lib/configPatch';

export let slateInstancePresenter = (
  inst: SlateInstance & {
    slate: Slate;
    lockedSlateVersion: SlateVersion | null;
    currentConfig: (SlateInstanceConfig & { schema: SlateConfigSchema }) | null;
  }
) => ({
  object: 'slate.instance',

  id: inst.id,
  slateId: inst.slate.id,
  lockedSlateVersionId: inst.lockedSlateVersion?.id || null,

  config: inst.currentConfig
    ? projectSlateConfigPresence({
        value: inst.currentConfig.value,
        fields: resolveStoredSlateConfigFieldDescriptors({
          schemaVersion: inst.currentConfig.schema.version,
          fields: inst.currentConfig.schema.fields,
          value: inst.currentConfig.value
        })
      })
    : {},
  configGeneration: inst.currentConfig?.generation ?? null,
  configSchema: inst.currentConfig
    ? {
        version: inst.currentConfig.schema.version,
        hash: inst.currentConfig.schema.descriptorHash,
        fields:
          inst.currentConfig.schema.version === 2
            ? parseSlateConfigFieldDescriptors(inst.currentConfig.schema.fields)
            : {}
      }
    : null,

  error: inst.currentConfig?.errorCode
    ? {
        code: inst.currentConfig.errorCode,
        message: inst.currentConfig.errorMessage ?? inst.currentConfig.errorCode,
        invocationId: inst.currentConfig.errorInvocationId ?? null
      }
    : null,

  createdAt: inst.createdAt,
  updatedAt: inst.updatedAt
});
