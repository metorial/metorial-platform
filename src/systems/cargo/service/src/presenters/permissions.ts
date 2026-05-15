import type {
  DocumentPermissionsResult,
  StorePermissionsResult
} from '@metorial-cargo/module-store';

export let documentPermissionsPresenter = (permissions: DocumentPermissionsResult) => ({
  object: 'cargo#document_permissions',
  documentId: permissions.documentId,
  actorId: permissions.actorId ?? null,
  isOwner: permissions.isOwner,
  hasFullAccess: permissions.hasFullAccess,
  permissions: permissions.permissions,
  relevantStoreIds: permissions.relevantStoreIds,
  readableStoreIds: permissions.readableStoreIds,
  writableStoreIds: permissions.writableStoreIds
});

export let storePermissionsPresenter = (permissions: StorePermissionsResult) => ({
  object: 'cargo#store_permissions',
  storeId: permissions.storeId,
  actorId: permissions.actorId ?? null,
  hasFullAccess: permissions.hasFullAccess,
  permissions: permissions.permissions,
  relevantStoreIds: permissions.relevantStoreIds,
  readableStoreIds: permissions.readableStoreIds,
  writableStoreIds: permissions.writableStoreIds
});
