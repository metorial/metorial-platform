import type { Slate, SlateTriggerGroup } from '../../prisma/generated/client';

export let slateTriggerGroupPresenter = (
  triggerGroup: SlateTriggerGroup & {
    slate: Slate;
  }
) => ({
  object: 'slate.trigger_group',

  id: triggerGroup.id,
  slateId: triggerGroup.slate.id,

  identifier: triggerGroup.identifier,

  name: triggerGroup.name,
  key: triggerGroup.key,

  description: triggerGroup.spec.description,
  metadata: triggerGroup.spec.metadata,
  invocation: triggerGroup.spec.invocation,

  createdAt: triggerGroup.createdAt
});
