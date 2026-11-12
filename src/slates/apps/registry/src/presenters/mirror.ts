import type {
  MirrorResult,
  MirrorUpstream,
  Scope,
  Slate,
  SlateActivation,
  SlatePackImport,
  SlateVersion
} from '../../prisma/generated/client';
import { getEffectiveCurrentSlateVersion } from '../lib/slateVersion/current';

let buildOf = (version: Pick<SlateVersion, 'backend'>) =>
  version.backend === 'npm' || version.backend === 'local_built' ? 'prebuilt' : 'unbuilt';

export let mirrorUpstreamPresenter = (upstream: MirrorUpstream) => ({
  object: 'slates_registry.mirror.upstream',

  id: upstream.id,
  source: upstream.source,
  status: upstream.status,

  name: upstream.name,
  url: upstream.url,
  subRegistryId: upstream.subRegistryId,

  lastSyncedAt: upstream.lastSyncedAt,
  lastSyncError: upstream.lastSyncError,
  lastSyncErrorAt: upstream.lastSyncErrorAt,

  createdAt: upstream.createdAt,
  updatedAt: upstream.updatedAt,
  archivedAt: upstream.archivedAt
});

export let slatePackImportPresenter = (packImport: SlatePackImport) => ({
  object: 'slates_registry.mirror.pack_import',

  id: packImport.id,
  status: packImport.status,

  fileName: packImport.fileName,
  size: Number(packImport.size),

  importedCount: packImport.importedCount,
  skippedCount: packImport.skippedCount,
  conflictCount: packImport.conflictCount,
  rejectedCount: packImport.rejectedCount,

  error: packImport.error,

  createdAt: packImport.createdAt,
  completedAt: packImport.completedAt
});

export let mirrorResultPresenter = (
  result: MirrorResult & {
    upstream: MirrorUpstream | null;
    packImport: SlatePackImport | null;
  }
) => ({
  object: 'slates_registry.mirror.result',

  id: result.id,
  status: result.status,

  slateIdentifier: result.slateIdentifier,
  version: result.version,
  message: result.message,

  source: result.upstream
    ? { type: 'upstream' as const, id: result.upstream.id, name: result.upstream.name }
    : result.packImport
      ? {
          type: 'pack' as const,
          id: result.packImport.id,
          name: result.packImport.fileName
        }
      : null,

  createdAt: result.createdAt
});

export let catalogSlatePresenter = (
  slate: Slate & {
    scope: Scope;
    unbuiltCurrentVersion: SlateVersion | null;
    builtOrUnbuiltCurrentVersion: SlateVersion | null;
    activation: (SlateActivation & { pinnedVersion: SlateVersion | null }) | null;
    _count: { slateVersions: number };
  }
) => {
  let latestVersion = getEffectiveCurrentSlateVersion({
    supportsBuilt: true,
    unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
    builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion
  });
  let currentVersion = getEffectiveCurrentSlateVersion({
    supportsBuilt: true,
    unbuiltCurrentVersion: slate.unbuiltCurrentVersion,
    builtOrUnbuiltCurrentVersion: slate.builtOrUnbuiltCurrentVersion,
    activation: slate.activation
  });

  return {
    object: 'slates_registry.mirror.catalog_slate',

    id: slate.id,
    identifier: slate.identifier,
    fullIdentifier: slate.fullIdentifier,

    name: slate.name,
    description: slate.description,
    logoUrl: slate.logoUrl,

    scopeIdentifier: slate.scope.identifier,
    versionCount: slate._count.slateVersions,

    activation: slate.activation
      ? {
          mode: slate.activation.mode,
          pinnedVersion: slate.activation.pinnedVersion
            ? {
                id: slate.activation.pinnedVersion.id,
                version: slate.activation.pinnedVersion.version
              }
            : null,
          activatedAt: slate.activation.createdAt,
          updatedAt: slate.activation.updatedAt
        }
      : null,

    latestVersion: latestVersion
      ? { id: latestVersion.id, version: latestVersion.version, build: buildOf(latestVersion) }
      : null,
    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          version: currentVersion.version,
          build: buildOf(currentVersion)
        }
      : null,

    createdAt: slate.createdAt,
    updatedAt: slate.updatedAt
  };
};

export let catalogSlateVersionPresenter = (
  version: SlateVersion & {
    _count: { signatures: number };
    originUpstream: MirrorUpstream | null;
    originPackImport: SlatePackImport | null;
  },
  o: { pinnedVersionOid: bigint | null }
) => ({
  object: 'slates_registry.mirror.catalog_slate_version',

  id: version.id,
  version: version.version,
  build: buildOf(version),

  origin: {
    type: version.origin,
    upstream: version.originUpstream
      ? { id: version.originUpstream.id, name: version.originUpstream.name }
      : null,
    packImport: version.originPackImport
      ? { id: version.originPackImport.id, fileName: version.originPackImport.fileName }
      : null
  },

  signatureCount: version._count.signatures,
  isPinned: o.pinnedVersionOid === version.oid,

  createdAt: version.createdAt
});
