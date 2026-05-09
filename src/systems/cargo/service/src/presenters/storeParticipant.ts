import type { Store, StoreParticipant, TenantActor } from '../../prisma/generated/client';
import { actorPresenter } from './actor';

export let storeParticipantPresenter = (
  participant: StoreParticipant & {
    store: Store;
    tenantActor: TenantActor;
  }
) => ({
  object: 'cargo#storeParticipant',
  id: participant.id,
  storeId: participant.store.id,
  permissions: participant.permissions,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt
});
