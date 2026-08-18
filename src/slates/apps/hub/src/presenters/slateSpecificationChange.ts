import type {
  Slate,
  Adapter,
  SlateAdapter,
  SlateAction,
  SlateAuthMethod,
  SlateSpecification,
  SlateSpecificationAction,
  SlateSpecificationAuthMethod,
  SlateSpecificationChange,
  SlateVersion
} from '../../prisma/generated/client';
import { slateSpecificationPresenter } from './slateSpecification';

export let slateSpecificationChangePresenter = (
  spec: SlateSpecificationChange & {
    slate: Slate;

    fromVersion: SlateVersion;
    toVersion: SlateVersion;

    fromSpecification: SlateSpecification & {
      slateAuthMethods: (SlateSpecificationAuthMethod & { authMethod: SlateAuthMethod })[];
      slateActions: (SlateSpecificationAction & {
        action: SlateAction & { slateAdapter: (SlateAdapter & { adapter: Adapter }) | null };
      })[];
    };
    toSpecification: SlateSpecification & {
      slateAuthMethods: (SlateSpecificationAuthMethod & { authMethod: SlateAuthMethod })[];
      slateActions: (SlateSpecificationAction & {
        action: SlateAction & { slateAdapter: (SlateAdapter & { adapter: Adapter }) | null };
      })[];
    };
  }
) => ({
  object: 'slate.specification_change',

  id: spec.id,
  type: spec.type,

  fromVersionId: spec.fromVersion.id,
  toVersionId: spec.toVersion.id,

  fromSpecification: slateSpecificationPresenter({
    ...spec.fromSpecification,
    slate: spec.slate
  }),
  toSpecification: slateSpecificationPresenter({
    ...spec.toSpecification,
    slate: spec.slate
  }),

  createdAt: spec.createdAt
});
