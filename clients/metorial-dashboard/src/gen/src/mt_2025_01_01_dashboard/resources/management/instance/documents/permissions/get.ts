import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceDocumentsPermissionsGetOutput = {
  object: 'document.permissions';
  documentId: string;
  isOwner: boolean;
  hasFullAccess: boolean;
  permissions: ('content_read' | 'content_write')[];
  relevantStoreIds: string[];
  readableStoreIds: string[];
  writableStoreIds: string[];
};

export let mapManagementInstanceDocumentsPermissionsGetOutput =
  mtMap.object<ManagementInstanceDocumentsPermissionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    documentId: mtMap.objectField('document_id', mtMap.passthrough()),
    isOwner: mtMap.objectField('is_owner', mtMap.passthrough()),
    hasFullAccess: mtMap.objectField('has_full_access', mtMap.passthrough()),
    permissions: mtMap.objectField(
      'permissions',
      mtMap.array(mtMap.passthrough())
    ),
    relevantStoreIds: mtMap.objectField(
      'relevant_store_ids',
      mtMap.array(mtMap.passthrough())
    ),
    readableStoreIds: mtMap.objectField(
      'readable_store_ids',
      mtMap.array(mtMap.passthrough())
    ),
    writableStoreIds: mtMap.objectField(
      'writable_store_ids',
      mtMap.array(mtMap.passthrough())
    )
  });

