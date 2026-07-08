import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceDocumentsEditTokenGetOutput = {
  object: 'document.edit_token';
  token: string;
  expiresAt: Date;
  documentId: string;
};

export let mapDashboardInstanceDocumentsEditTokenGetOutput =
  mtMap.object<DashboardInstanceDocumentsEditTokenGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    token: mtMap.objectField('token', mtMap.passthrough()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    documentId: mtMap.objectField('document_id', mtMap.passthrough())
  });

