import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentVersionType } from '../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

export let v1DocumentVersionPresenter = Presenter.create(documentVersionType)
  .presenter(async ({ documentVersion }, opts) => ({
    object: 'document.version',
    id: documentVersion.id,
    document_id: documentVersion.documentId,
    version_number: documentVersion.versionNumber,
    previous_version_id: documentVersion.previousVersionId ?? null,
    list_edited_at: documentVersion.listEditedAt ?? null,
    content: documentVersion.content,
    editors: await Promise.all(
      documentVersion.editors.map(
        async actor => await presentDocumentParticipantActor(actor, opts)
      )
    ),
    created_at: documentVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('document.version', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      document_id: v.string(),
      version_number: v.number(),
      previous_version_id: v.nullable(v.string()),
      list_edited_at: v.nullable(v.date()),
      content: v.string(),
      editors: v.array(documentParticipantActorSchema),
      created_at: v.date()
    })
  )
  .build();
