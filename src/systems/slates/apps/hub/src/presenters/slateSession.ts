import type {
  Slate,
  SlateInstance,
  SlateSession,
  SlateVersion
} from '../../prisma/generated/client';

export let slateSessionPresenter = (
  inst: SlateSession & {
    slate: Slate;
    slateInstance: SlateInstance;
    slateVersion: SlateVersion;
  }
) => ({
  object: 'slate.session',

  id: inst.id,

  slateId: inst.slate.id,
  slateInstanceId: inst.slateInstance.id,
  slateVersionId: inst.slateVersion.id,

  createdAt: inst.createdAt,
  lastActiveAt: inst.lastActiveAt
});
