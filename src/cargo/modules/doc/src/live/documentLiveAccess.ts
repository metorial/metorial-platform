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
