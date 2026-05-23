import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { storeParticipantType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

export let v1StoreParticipantPresenter = Presenter.create(storeParticipantType)
  .presenter(async ({ storeParticipant }, opts) => ({
    object: 'store.participant',
    id: storeParticipant.id,
    store_id: storeParticipant.storeId,
    permissions: storeParticipant.permissions,
    actor: await presentDocumentParticipantActor(storeParticipant.actor, opts),
    created_at: storeParticipant.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('store.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      store_id: v.string(),
      permissions: v.array(v.enumOf(['content_read', 'content_write'])),
      actor: documentParticipantActorSchema,
      created_at: v.date()
    })
  )
  .build();
