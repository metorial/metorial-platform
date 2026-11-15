export type DocumentLiveMutationType =
  | 'yjs_update'
  | 'yjs_state_initialize'
  | 'document_update'
  | 'document_title_update'
  | 'document_snapshot_save';

let documentLiveMutationTypes = new Set<DocumentLiveMutationType>([
  'yjs_update',
  'yjs_state_initialize',
  'document_update',
  'document_title_update',
  'document_snapshot_save'
]);

export let canSendDocumentLiveMessage = (d: { canWrite: boolean; type: string }) =>
  d.canWrite || !documentLiveMutationTypes.has(d.type as DocumentLiveMutationType);

export type DocumentLiveIdentity = {
  documentId: string;
  instanceId: string;
  organizationId: string;
  actorId: string;
};

export let hasSameDocumentLiveIdentity = (
  current: DocumentLiveIdentity,
  replacement: DocumentLiveIdentity
) =>
  current.documentId === replacement.documentId &&
  current.instanceId === replacement.instanceId &&
  current.organizationId === replacement.organizationId &&
  current.actorId === replacement.actorId;

export let isDocumentLiveTokenExpired = (expiresAt: number, now = Date.now()) =>
  expiresAt <= now;
