import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { documentType } from '../../types';
import { documentParticipantActorSchema, presentDocumentParticipantActor } from './documentParticipant';

export let v1DocumentPresenter = Presenter.create(documentType)
  .presenter(async ({ document }, opts) => ({
    object: 'document',
    id: document.id,
    status: document.status,
    title: document.title,
    content: document.content,
    file_id: document.fileId,
    parent_document_id: document.parentDocumentId ?? null,
    current_version_id: document.currentVersionId ?? null,
    created_by: document.createdBy
      ? await presentDocumentParticipantActor(document.createdBy, opts)
      : null,
    created_at: document.createdAt,
    updated_at: document.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('document', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      status: v.enumOf(['active', 'deleted']),
      title: v.string(),
      content: v.string(),
      file_id: v.string(),
      parent_document_id: v.nullable(v.string()),
      current_version_id: v.nullable(v.string()),
      created_by: v.nullable(documentParticipantActorSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
