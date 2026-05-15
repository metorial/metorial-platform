import type {
  Document,
  DocumentParticipant,
  TenantActor
} from '@metorial-cargo/db';
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
  role: participant.role,
  editCount: participant.editCount,
  lastEditedAt: participant.lastEditedAt,
  lastViewedAt: participant.lastViewedAt,
  actor: actorPresenter(participant.tenantActor),
  createdAt: participant.createdAt
});
