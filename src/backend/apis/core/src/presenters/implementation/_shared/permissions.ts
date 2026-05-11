import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentPermissionsType, storePermissionsType } from '../../types';

let cargoPermissionSchema = v.enumOf(['content_read', 'content_write']);

let permissionsBaseSchema = {
  actor_id: v.nullable(v.string()),
  has_full_access: v.boolean(),
  permissions: v.array(cargoPermissionSchema),
  relevant_store_ids: v.array(v.string()),
  readable_store_ids: v.array(v.string()),
  writable_store_ids: v.array(v.string())
} as const;

export let v1DocumentPermissionsPresenter = Presenter.create(documentPermissionsType)
  .presenter(async ({ permissions }) => ({
    object: 'document.permissions',
    document_id: permissions.documentId,
    actor_id: permissions.actorId ?? null,
    is_owner: permissions.isOwner,
    has_full_access: permissions.hasFullAccess,
    permissions: permissions.permissions,
    relevant_store_ids: permissions.relevantStoreIds,
    readable_store_ids: permissions.readableStoreIds,
    writable_store_ids: permissions.writableStoreIds
  }))
  .schema(
    v.object({
      object: v.literal('document.permissions', {
        description: "String representing the object's type"
      }),
      document_id: v.string(),
      is_owner: v.boolean(),
      ...permissionsBaseSchema
    })
  )
  .build();

export let v1StorePermissionsPresenter = Presenter.create(storePermissionsType)
  .presenter(async ({ permissions }) => ({
    object: 'store.permissions',
    store_id: permissions.storeId,
    actor_id: permissions.actorId ?? null,
    has_full_access: permissions.hasFullAccess,
    permissions: permissions.permissions,
    relevant_store_ids: permissions.relevantStoreIds,
    readable_store_ids: permissions.readableStoreIds,
    writable_store_ids: permissions.writableStoreIds
  }))
  .schema(
    v.object({
      object: v.literal('store.permissions', {
        description: "String representing the object's type"
      }),
      store_id: v.string(),
      ...permissionsBaseSchema
    })
  )
  .build();
