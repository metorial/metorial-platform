import type {
  Registry,
  Slate,
  SlateSpecification,
  SlateVersion
} from '../../prisma/generated/client';
import { slateVersionPresenter } from './slateVersion';

export let slatePresenter = (
  slate: Slate & {
    registry: Registry;
    currentVersion:
      | (SlateVersion & {
          specification: SlateSpecification | null;
        })
      | null;
  }
) => ({
  object: 'slate',

  id: slate.id,

  identifier: slate.identifier,
  name: slate.name,
  description: slate.description,

  registryId: slate.registry.id,

  currentVersion: slate.currentVersion
    ? slateVersionPresenter({
        ...slate.currentVersion,
        slate: slate
      })
    : null,

  scope: {
    object: 'slate.registry_scope',

    registryId: slate.registry.id,
    id: slate.slateScopeIdOnRegistry,
    identifier: slate.slateScopeIdentifierOnRegistry
  },

  slate: {
    object: 'slate.registry_slate',

    registryId: slate.registry.id,
    id: slate.slateIdOnRegistry,
    identifier: slate.slateIdentifierOnRegistry,
    fullIdentifier: slate.slateFullIdentifierOnRegistry
  },

  createdAt: slate.createdAt,
  updatedAt: slate.updatedAt
});
