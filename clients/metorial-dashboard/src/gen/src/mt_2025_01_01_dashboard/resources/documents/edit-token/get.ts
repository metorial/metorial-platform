import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DocumentsEditTokenGetOutput = {
  object: 'document.edit_token';
  token: string;
  expiresAt: Date;
  documentId: string;
};

export let mapDocumentsEditTokenGetOutput =
  /* @__PURE__ */ mapObject<DocumentsEditTokenGetOutput>(
    ['expires_at', 'document_id'],
    1
  );
