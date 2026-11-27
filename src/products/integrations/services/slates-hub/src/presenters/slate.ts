import type {
  Registry,
  Adapter,
  SlateAdapter,
  Slate,
  SlateSpecification,
  SlateVersion,
  SlateVersionAdapter,
  SlateVersionAdapterCapability,
  AdapterCapability
} from '../../prisma/generated/client';
import { slateVersionPresenter } from './slateVersion';

export let slatePresenter = (
  slate: Slate & {
    registry: Registry;
    currentVersion:
      | (SlateVersion & {
          specification: SlateSpecification | null;
          slateVersionAdapters?: (SlateVersionAdapter & {
            slateAdapter: SlateAdapter & { adapter: Adapter };
            slateVersionAdapterCapabilities: (SlateVersionAdapterCapability & {
              adapterCapability: AdapterCapability;
            })[];
          })[];
        })
      | null;
    slateVersions?: (SlateVersion & {
      specification: SlateSpecification | null;
      slateVersionAdapters?: (SlateVersionAdapter & {
        slateAdapter: SlateAdapter & { adapter: Adapter };
        slateVersionAdapterCapabilities: (SlateVersionAdapterCapability & {
          adapterCapability: AdapterCapability;
        })[];
      })[];
    })[];
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

  latestVersion: slate.slateVersions?.[0]
    ? slateVersionPresenter({
        ...slate.slateVersions[0],
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
