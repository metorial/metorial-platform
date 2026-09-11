import type {
  Adapter,
  Slate,
  SlateAction,
  SlateAdapter,
  SlateTriggerGroup
} from '../../prisma/generated/client';
import { adapterPresenter } from './adapter';
import { slateTriggerGroupPresenter } from './slateTriggerGroup';

export let slateActionPresenter = (
  method: SlateAction & {
    slate: Slate;
    slateAdapter: (SlateAdapter & { adapter: Adapter }) | null;
    triggerGroup: SlateTriggerGroup | null;
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
    isPublic: method.isPublic,

    capabilities: method.spec.capabilities,
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
    adapter: method.slateAdapter
      ? adapterPresenter(method.slateAdapter.adapter, method.slateAdapter.identifier)
      : null,

    triggerGroup:
      method.spec.type === 'action.trigger' && method.triggerGroup
        ? slateTriggerGroupPresenter({
            ...method.triggerGroup,
            slate: method.slate
          })
        : undefined,

    createdAt: method.createdAt
  };
};
