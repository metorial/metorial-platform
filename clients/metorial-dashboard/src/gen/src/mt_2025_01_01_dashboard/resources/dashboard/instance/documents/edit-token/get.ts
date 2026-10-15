import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceDocumentsEditTokenGetOutput = {
  object: 'document.edit_token';
  token: string;
  expiresAt: Date;
  documentId: string;
};

export let mapDashboardInstanceDocumentsEditTokenGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceDocumentsEditTokenGetOutput>(
    ['expires_at', 'document_id'],
    1
  );
