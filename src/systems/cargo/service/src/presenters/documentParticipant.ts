import type { Document, DocumentParticipant, TenantActor } from '../../prisma/generated/client';
import { actorPresenter } from './actor';

export let documentParticipantPresenter = (
  participant: DocumentParticipant & {
    document: Document;
    tenantActor: TenantActor;
  }
) => ({
  object: 'cargo#documentParticipant',
  id: participant.id,
  documentId: participant.document.id,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt
});
