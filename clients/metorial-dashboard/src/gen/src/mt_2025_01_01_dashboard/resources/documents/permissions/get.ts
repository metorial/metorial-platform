import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DocumentsPermissionsGetOutput = {
  object: 'document.permissions';
  documentId: string;
  isOwner: boolean;
  hasFullAccess: boolean;
  permissions: ('content_read' | 'content_write')[];
  relevantStoreIds: string[];
  readableStoreIds: string[];
  writableStoreIds: string[];
};

export let mapDocumentsPermissionsGetOutput =
  /* @__PURE__ */ mapObject<DocumentsPermissionsGetOutput>([
    'document_id',
    'is_owner',
    'has_full_access',
    'relevant_store_ids',
    'readable_store_ids',
    'writable_store_ids'
  ]);
