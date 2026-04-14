import type {
  Scope,
  Slate,
  SlateDocument,
  SlateVersion,
  Tenant,
  User
} from '../../prisma/generated/client';
import { userPresenter } from './user';

export let slateVersionPresenter = (
  slateVersion: SlateVersion & {
    slate: Slate & {
      tenant: Tenant;
    };
    createdByUser: User & { scope: Scope };
    slateDocuments: SlateDocument[];
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
  build: slateVersion.backend === 'npm' ? 'prebuilt' : 'unbuilt',

  slateId: slateVersion.slate.id,

  manifest: slateVersion.slateJson,

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
