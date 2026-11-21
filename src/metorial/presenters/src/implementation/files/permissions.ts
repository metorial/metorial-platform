import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentPermissionsType, storePermissionsType } from '../../types';

let cargoPermissionSchema = v.enumOf(['content_read', 'content_write']);

let permissionsBaseSchema = {
  has_full_access: v.boolean({
    description: 'Whether the caller has full access.'
  }),
  permissions: v.array(cargoPermissionSchema, {
    description: 'Permissions the caller has.'
  }),
  relevant_store_ids: v.array(v.string(), {
    description: 'Stores this resource belongs to.'
  }),
  readable_store_ids: v.array(v.string(), {
    description: 'Relevant stores the caller can read.'
  }),
  writable_store_ids: v.array(v.string(), {
    description: 'Relevant stores the caller can write to.'
  })
} as const;

export let v1DocumentPermissionsPresenter = Presenter.create(documentPermissionsType)
  .presenter(async ({ permissions }) => ({
    object: 'document.permissions',
    document_id: permissions.documentId,
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
        description: 'String representing the object’s type.'
      }),
      document_id: v.string({ description: 'Document these permissions apply to.' }),
      is_owner: v.boolean({ description: 'Whether the caller owns the document.' }),
      ...permissionsBaseSchema
    })
  )
  .build();

export let v1StorePermissionsPresenter = Presenter.create(storePermissionsType)
  .presenter(async ({ permissions }) => ({
    object: 'store.permissions',
    store_id: permissions.storeId,
    has_full_access: permissions.hasFullAccess,
    can_manage_access: permissions.canManageAccess,
    permissions: permissions.permissions,
    relevant_store_ids: permissions.relevantStoreIds,
    readable_store_ids: permissions.readableStoreIds,
    writable_store_ids: permissions.writableStoreIds
  }))
  .schema(
    v.object({
      object: v.literal('store.permissions', {
        description: 'String representing the object’s type.'
      }),
      store_id: v.string({ description: 'Store these permissions apply to.' }),
      can_manage_access: v.boolean({
        description:
          'Whether the current actor can manage who has access to the skill backed by this store.'
      }),
      ...permissionsBaseSchema
    })
  )
  .build();
