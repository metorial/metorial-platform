import type { Slate, SlateAction, SlateTriggerGroup } from '../../prisma/generated/client';

export let slateActionPresenter = (
  method: SlateAction & {
    slate: Slate;
    triggerGroup?: SlateTriggerGroup | null;
  }
) => {
  let spec = method.spec as typeof method.spec & { authMethods?: string[] | null };

  return {
    object: 'slate.action',

    id: method.id,
    slateId: method.slate.id,

    identifier: method.identifier,

    name: method.name,
    key: method.key,
    type: method.type,

    capabilities: method.spec.capabilities,
    triggerGroupId: method.spec.type === 'action.trigger' ? method.triggerGroup?.id : undefined,
    inputSchema: method.spec.inputSchema,
    outputSchema: method.spec.outputSchema,
    constraints: method.spec.constraints,
    description: method.spec.description,
    instructions: method.spec.instructions,
    docs: method.spec.docs ?? [],
    metadata: method.spec.metadata,
    tags: method.spec.tags,
    scopes: method.spec.scopes,
    authMethods: spec.authMethods,

    createdAt: method.createdAt
  };
};
