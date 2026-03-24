import type { Slate, SlateInstance, SlateSession } from '../../prisma/generated/client';

export let slateSessionPresenter = (
  inst: SlateSession & {
    slate: Slate;
    slateInstance: SlateInstance;
  }
) => ({
  object: 'slate.session',

  id: inst.id,

  slateId: inst.slate.id,
  slateInstanceId: inst.slateInstance.id,

  createdAt: inst.createdAt,
  lastActiveAt: inst.lastActiveAt
});
