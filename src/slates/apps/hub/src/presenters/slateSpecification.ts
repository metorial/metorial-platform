import type {
  Slate,
  Adapter,
  SlateAdapter,
  SlateAction,
  SlateAuthMethod,
  SlateSpecification,
  SlateSpecificationAction,
  SlateSpecificationAuthMethod
} from '../../prisma/generated/client';
import { slateActionPresenter } from './slateAction';
import { slateAuthMethodPresenter } from './slateAuthMethod';

export let slateSpecificationPresenter = (
  spec: Omit<SlateSpecification, 'authMethods' | 'actions'> & {
    slate: Slate;

    slateAuthMethods: (SlateSpecificationAuthMethod & { authMethod: SlateAuthMethod })[];
    slateActions: (SlateSpecificationAction & {
      action: SlateAction & { slateAdapter: (SlateAdapter & { adapter: Adapter }) | null };
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

  createdAt: spec.createdAt
});
