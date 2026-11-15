let documentLiveMutationTypes = new Set([
  'yjs_update',
  'yjs_state_initialize',
  'document_update',
  'document_title_update',
  'document_snapshot_save'
]);

export let isDocumentLiveMutation = (message: string) => {
  try {
    let parsed = JSON.parse(message);
    return typeof parsed?.type === 'string' && documentLiveMutationTypes.has(parsed.type);
  } catch {
    return false;
  }
};
