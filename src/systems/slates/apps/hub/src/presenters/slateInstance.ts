import type {
  Slate,
  SlateInstance,
  SlateInstanceConfig,
  SlateVersion
} from '../../prisma/generated/client';

export let slateInstancePresenter = (
  inst: SlateInstance & {
    slate: Slate;
    lockedSlateVersion: SlateVersion | null;
    currentConfig: SlateInstanceConfig | null;
  }
) => ({
  object: 'slate.instance',

  id: inst.id,
  slateId: inst.slate.id,
  lockedSlateVersionId: inst.lockedSlateVersion?.id || null,

  config: inst.currentConfig?.value ?? {},

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
