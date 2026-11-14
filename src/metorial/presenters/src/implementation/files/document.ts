import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { documentType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

export let v1DocumentPresenter = Presenter.create(documentType)
  .presenter(async ({ document }, opts) => ({
    object: 'document',
    id: document.id,
    status: document.file.status,
    title: document.resolvedTitle ?? document.title,
    content: document.resolvedContent ?? document.content.content,
    file_id: document.file.id,
    parent_document_id: document.parentDocument?.id ?? null,
    current_version_id: document.currentVersion?.id ?? null,
    created_by: document.createdByResourceActor
      ? await presentDocumentParticipantActor(document.createdByResourceActor, opts)
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

export let dashboardDocumentPresenter = Presenter.create(documentType)
  .presenter(async ({ document }, opts) => {
    let inner = await v1DocumentPresenter.present({ document }, opts).run();
    let annotations = document.hasDraft
      ? (document.resolvedAnnotations ?? null)
      : (document.content.annotations ?? null);

    return {
      ...inner,
      annotations,
      annotation_actors: await Promise.all(
        (document.annotationActors ?? []).map(async actor => ({
          id: actor.id,
          ...(await presentDocumentParticipantActor(actor, opts))
        }))
      )
    };
  })
  .schema(
    v.object({
      ...v1DocumentPresenter.schema.properties,
      annotations: v.nullable(
        v.any({
          name: 'annotations',
          description:
            'Per-block editor attribution and comment anchors for the document body, bound to `content` by a content hash. Consumed by the document editor.'
        })
      ),
      annotation_actors: v.array(
        v.object({
          id: v.string({
            name: 'id',
            description: 'The resource actor id referenced from `annotations`'
          }),
          ...documentParticipantActorSchema.properties
        }),
        {
          name: 'annotation_actors',
          description: 'The actors referenced as editors in `annotations`'
        }
      )
    }) as any
  )
  .build();
