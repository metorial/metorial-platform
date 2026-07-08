import type {
  DashboardInstanceDocumentsCloneBody,
  DashboardInstanceDocumentsCreateBody,
  DashboardInstanceDocumentsGetOutput,
  DashboardInstanceDocumentsListQuery,
  DashboardInstanceDocumentsParticipantsGetOutput,
  DashboardInstanceDocumentsParticipantsListQuery,
  DashboardInstanceDocumentsPermissionsGetOutput,
  DashboardInstanceDocumentsUpdateBody,
  DashboardInstanceDocumentsVersionsGetOutput,
  DashboardInstanceDocumentsVersionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type Document = DashboardInstanceDocumentsGetOutput;
export type DocumentEditToken = {
  object: 'document.edit_token';
  token: string;
  expiresAt: Date;
  documentId: string;
};
export type DocumentParticipant = DashboardInstanceDocumentsParticipantsGetOutput;
export type DocumentPermissions = DashboardInstanceDocumentsPermissionsGetOutput;
export type DocumentVersion = DashboardInstanceDocumentsVersionsGetOutput;

export let documentsLoader = createLoader({
  name: 'documents',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceDocumentsListQuery) =>
    withAuth(sdk => sdk.documents.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateDocument = documentsLoader.createExternalMutator(
  (i: DashboardInstanceDocumentsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.documents.create(i.instanceId, i))
);

export let useCloneDocument = documentsLoader.createExternalMutator(
  (i: DashboardInstanceDocumentsCloneBody & { instanceId: string; documentId: string }) =>
    withAuth(sdk => sdk.documents.clone(i.instanceId, i.documentId, i))
);

export let useDocuments = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceDocumentsListQuery | null
) => {
  return usePaginator(
    pagination =>
      documentsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ?? null
  );
};

export let documentLoader = createLoader({
  name: 'document',
  parents: [documentsLoader],
  fetch: (i: { instanceId: string; documentId: string }) =>
    withAuth(sdk => sdk.documents.get(i.instanceId, i.documentId)),
  mutators: {
    update: (
      i: DashboardInstanceDocumentsUpdateBody,
      {
        input: { instanceId, documentId }
      }: { input: { instanceId: string; documentId: string } }
    ) => withAuth(sdk => sdk.documents.update(instanceId, documentId, i)),

    delete: (
      _: void,
      {
        input: { instanceId, documentId }
      }: { input: { instanceId: string; documentId: string } }
    ) => withAuth(sdk => sdk.documents.delete(instanceId, documentId))
  }
});

export let useDocument = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined
) => {
  let data = documentLoader.use(instanceId && documentId ? { instanceId, documentId } : null);

  return {
    ...data,
    updateMutator: data.useMutator('update'),
    deleteMutator: data.useMutator('delete')
  };
};

export let updateDocument = (
  body: DashboardInstanceDocumentsUpdateBody & {
    instanceId: string;
    documentId: string;
  }
) => withAuth(sdk => sdk.documents.update(body.instanceId, body.documentId, body));

export let getDocumentEditToken = (d: { instanceId: string; documentId: string }) =>
  withAuth(
    sdk =>
      (sdk.documents as any).editToken.get(
        d.instanceId,
        d.documentId
      ) as Promise<DocumentEditToken>
  );

export let documentPermissionsLoader = createLoader({
  name: 'documentPermissions',
  parents: [documentLoader],
  fetch: (i: { instanceId: string; documentId: string }) =>
    withAuth(sdk => sdk.documents.permissions.get(i.instanceId, i.documentId)),
  mutators: {}
});

export let useDocumentPermissions = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined
) => {
  return documentPermissionsLoader.use(
    instanceId && documentId ? { instanceId, documentId } : null
  );
};

export let documentEditTokenLoader = createLoader({
  name: 'documentEditToken',
  parents: [documentLoader],
  fetch: (i: { instanceId: string; documentId: string }) => getDocumentEditToken(i),
  mutators: {}
});

export let useDocumentEditToken = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  enabled?: boolean
) => {
  return documentEditTokenLoader.use(
    enabled !== false && instanceId && documentId ? { instanceId, documentId } : null
  );
};

export let documentParticipantsLoader = createLoader({
  name: 'documentParticipants',
  parents: [documentLoader],
  fetch: (
    i: {
      instanceId: string;
      documentId: string;
    } & DashboardInstanceDocumentsParticipantsListQuery
  ) => withAuth(sdk => sdk.documents.participants.list(i.instanceId, i.documentId, i)),
  mutators: {}
});

export let useDocumentParticipants = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  query?: DashboardInstanceDocumentsParticipantsListQuery | null
) => {
  return usePaginator(
    pagination =>
      documentParticipantsLoader.use(
        instanceId && documentId && query !== null
          ? { instanceId, documentId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && documentId ? `${instanceId}:${documentId}` : null
  );
};

export let documentParticipantLoader = createLoader({
  name: 'documentParticipant',
  parents: [documentParticipantsLoader, documentLoader],
  fetch: (i: { instanceId: string; documentId: string; documentParticipantId: string }) =>
    withAuth(sdk =>
      sdk.documents.participants.get(i.instanceId, i.documentId, i.documentParticipantId)
    ),
  mutators: {}
});

export let useDocumentParticipant = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  documentParticipantId: string | null | undefined
) => {
  return documentParticipantLoader.use(
    instanceId && documentId && documentParticipantId
      ? { instanceId, documentId, documentParticipantId }
      : null
  );
};

export let documentVersionsLoader = createLoader({
  name: 'documentVersions',
  parents: [documentLoader],
  fetch: (
    i: {
      instanceId: string;
      documentId: string;
    } & DashboardInstanceDocumentsVersionsListQuery
  ) => withAuth(sdk => sdk.documents.versions.list(i.instanceId, i.documentId, i)),
  mutators: {}
});

export let useDocumentVersions = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  query?: DashboardInstanceDocumentsVersionsListQuery | null
) => {
  return usePaginator(
    pagination =>
      documentVersionsLoader.use(
        instanceId && documentId && query !== null
          ? { instanceId, documentId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && documentId ? `${instanceId}:${documentId}` : null
  );
};

export let documentVersionLoader = createLoader({
  name: 'documentVersion',
  parents: [documentVersionsLoader, documentLoader],
  fetch: (i: { instanceId: string; documentId: string; documentVersionId: string }) =>
    withAuth(sdk =>
      sdk.documents.versions.get(i.instanceId, i.documentId, i.documentVersionId)
    ),
  mutators: {}
});

export let useDocumentVersion = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined,
  documentVersionId: string | null | undefined
) => {
  return documentVersionLoader.use(
    instanceId && documentId && documentVersionId
      ? { instanceId, documentId, documentVersionId }
      : null
  );
};
