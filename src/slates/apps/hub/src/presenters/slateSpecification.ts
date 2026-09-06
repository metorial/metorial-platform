import type {
  Slate,
  SlateAction,
  SlateAuthMethod,
  SlateSpecification,
  SlateSpecificationAction,
  SlateSpecificationAuthMethod,
  SlateSpecificationTriggerGroup,
  SlateTriggerGroup
} from '../../prisma/generated/client';
import { slateActionPresenter } from './slateAction';
import { slateAuthMethodPresenter } from './slateAuthMethod';
import { slateTriggerGroupPresenter } from './slateTriggerGroup';

export let slateSpecificationPresenter = (
  spec: Omit<SlateSpecification, 'authMethods' | 'actions' | 'triggerGroups'> & {
    slate: Slate;

    slateAuthMethods: (SlateSpecificationAuthMethod & { authMethod: SlateAuthMethod })[];
    slateActions: (SlateSpecificationAction & {
      action: SlateAction & { triggerGroup: SlateTriggerGroup | null };
    })[];
    slateTriggerGroups: (SlateSpecificationTriggerGroup & {
      triggerGroup: SlateTriggerGroup;
    })[];
  }
) => ({
  object: 'slate.specification',

  id: spec.id,
  slateId: spec.slate.id,

  identifier: spec.identifier,

  name: spec.name,
  key: spec.key,
  protocolVersion: spec.protocolVersion,

  providerInfo: spec.providerInfo,
  providerDocs: spec.providerDocs,
  configSchema: spec.configSchema,
  configSchemaDocs: spec.configSchemaDocs,

  authMethods: spec.slateAuthMethods.map(sam =>
    slateAuthMethodPresenter({ ...sam.authMethod, slate: spec.slate })
  ),
  tools: spec.slateActions
    .filter(sa => sa.action.type === 'tool')
    .map(sa => slateActionPresenter({ ...sa.action, slate: spec.slate })),
  triggers: spec.slateActions
    .filter(sa => sa.action.type === 'trigger')
    .map(sa => slateActionPresenter({ ...sa.action, slate: spec.slate })),
  triggerGroups: spec.slateTriggerGroups.map(stg =>
    slateTriggerGroupPresenter({ ...stg.triggerGroup, slate: spec.slate })
  ),

  createdAt: spec.createdAt
});
