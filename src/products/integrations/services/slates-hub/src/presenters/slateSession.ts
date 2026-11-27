import type {
  Slate,
  SlateInstance,
  SlateInstanceConfiguration,
  SlateSession,
  SlateVersion
} from '../../prisma/generated/client';

export let slateSessionPresenter = (
  inst: SlateSession & {
    slate: Slate;
    slateInstance: SlateInstance;
    slateVersion: SlateVersion;
    instanceConfiguration: SlateInstanceConfiguration | null;
  }
) => ({
  object: 'slate.session',

  id: inst.id,

  slateId: inst.slate.id,
  slateInstanceId: inst.slateInstance.id,
  slateVersionId: inst.slateVersion.id,
  slateInstanceConfigurationId: inst.instanceConfiguration?.id,

  createdAt: inst.createdAt,
  lastActiveAt: inst.lastActiveAt
});
