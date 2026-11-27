import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentVersionType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

export let v1DocumentVersionPresenter = Presenter.create(documentVersionType)
  .presenter(async ({ documentVersion }, opts) => ({
    object: 'document.version',
    id: documentVersion.id,
    document_id: documentVersion.document.id,
    version_number: documentVersion.versionNumber,
    previous_version_id: documentVersion.previousVersion?.id ?? null,
    list_edited_at: documentVersion.listEditedAt ?? null,
    content: documentVersion.content.content,
    editors: await Promise.all(
      documentVersion.documentVersionEditors.map(
        async editor => await presentDocumentParticipantActor(editor.resourceActor, opts)
      )
    ),
    created_at: documentVersion.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('document.version', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({ description: 'Unique ID.' }),
      document_id: v.string({ description: 'Document this version belongs to.' }),
      version_number: v.number({ description: 'Sequential number of this version.' }),
      previous_version_id: v.nullable(
        v.string({ description: 'Previous version, by ID. `null` for the first version.' })
      ),
      list_edited_at: v.nullable(
        v.date({ description: 'When the version content was last changed.' })
      ),
      content: v.string({ description: 'Text body of the document at this version.' }),
      editors: v.array(documentParticipantActorSchema, {
        description: 'Actors who edited this version.'
      }),
      created_at: v.date({ description: 'Creation time.' })
    })
  )
  .build();
