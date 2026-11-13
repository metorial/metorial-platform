import type {
  Artifact,
  Scope,
  Slate,
  SlateDocument,
  SlateVersion,
  SlateVersionSignature,
  Tenant,
  User
} from '../../prisma/generated/client';
import { contentChecksumAlgorithm } from '../lib/signature';
import { userPresenter } from './user';

export let slateVersionPresenter = (
  slateVersion: SlateVersion & {
    slate: Slate & {
      tenant: Tenant;
    };
    createdByUser: User & { scope: Scope };
    slateDocuments: SlateDocument[];
    bundleArtifact?: Artifact;
    signatures?: SlateVersionSignature[];
  },
  o?: {
    currentVersionId?: string | null;
  }
) => ({
  object: 'slate.version',

  id: slateVersion.id,
  version: slateVersion.version,
  isCurrent: o?.currentVersionId
    ? o.currentVersionId === slateVersion.id
    : slateVersion.isCurrent,
  build:
    slateVersion.backend === 'npm' || slateVersion.backend === 'local_built'
      ? 'prebuilt'
      : 'unbuilt',

  slateId: slateVersion.slate.id,

  manifest: slateVersion.slateJson,

  contentChecksum: slateVersion.bundleArtifact?.checksum || null,
  contentChecksumAlgorithm,

  signatures: (slateVersion.signatures ?? []).map(signature => ({
    kid: signature.kid,
    signature: signature.signature
  })),

  documents: slateVersion.slateDocuments.map(doc => ({
    object: 'slate.document',

    id: doc.id,
    versionId: slateVersion.id,

    path: doc.path,
    content: doc.content,

    createdAt: doc.createdAt
  })),

  createdByUser: userPresenter({
    ...slateVersion.createdByUser,
    tenant: slateVersion.slate.tenant
  }),

  createdAt: slateVersion.createdAt
});
