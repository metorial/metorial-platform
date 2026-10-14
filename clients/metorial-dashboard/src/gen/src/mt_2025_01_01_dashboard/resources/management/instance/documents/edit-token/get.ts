import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceDocumentsEditTokenGetOutput = {
  object: 'document.edit_token';
  token: string;
  expiresAt: Date;
  documentId: string;
};

export let mapManagementInstanceDocumentsEditTokenGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceDocumentsEditTokenGetOutput>(
    ['expires_at', 'document_id'],
    1
  );
