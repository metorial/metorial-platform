import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { storeParticipantType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';
import {
  getStoreResourceParticipantPermissions,
  isStoreResourceParticipantRecord,
  presentStoreResourceParticipantSurfaces,
  storeParticipantRolesSchema,
  storeParticipantSurfaceSchema,
  type StoreParticipantSurface
} from './storeResourceParticipant';

export let v1StoreParticipantPresenter = Presenter.create(storeParticipantType)
  .presenter(async ({ storeParticipant }, opts) => {
    if (isStoreResourceParticipantRecord(storeParticipant)) {
      return {
        object: 'store.participant' as const,
        id: storeParticipant.id,
        store_id: storeParticipant.store.id,
        permissions: getStoreResourceParticipantPermissions(storeParticipant),
        roles: storeParticipant.roles,
        actor: await presentDocumentParticipantActor(
          storeParticipant.primaryResourceActor,
          opts
        ),
        surfaces: await presentStoreResourceParticipantSurfaces(storeParticipant, opts),
        last_active_at: storeParticipant.lastActiveAt,
        created_at: storeParticipant.createdAt,
        updated_at: storeParticipant.updatedAt
      };
    }

    return {
      object: 'store.participant' as const,
      id: storeParticipant.id,
      store_id: storeParticipant.store.id,
      permissions: storeParticipant.permissions,
      roles: storeParticipant.roles,
      actor: await presentDocumentParticipantActor(storeParticipant.resourceActor, opts),
      surfaces: null as StoreParticipantSurface[] | null,
      last_active_at: storeParticipant.lastActiveAt,
      created_at: storeParticipant.createdAt,
      updated_at: storeParticipant.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('store.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      store_id: v.string(),
      permissions: v.array(v.enumOf(['content_read', 'content_write'])),
      roles: storeParticipantRolesSchema,
      actor: documentParticipantActorSchema,
      surfaces: v.nullable(v.array(storeParticipantSurfaceSchema)),
      last_active_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
