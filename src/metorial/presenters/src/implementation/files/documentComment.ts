import { v } from '@lowerdeck/validation';
import type { PresenterContext } from '@metorial/presenter';
import { Presenter } from '@metorial/presenter';
import { documentCommentThreadType, documentCommentType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from './documentParticipant';

let documentCommentSchema = v.object({
  object: v.literal('document.comment', {
    description: "String representing the object's type"
  }),
  id: v.string({ description: 'The unique identifier of the comment' }),
  thread_id: v.string({ description: 'The comment thread this comment belongs to' }),
  body: v.string({ description: 'The plain-text body of the comment' }),
  author_id: v.string({ description: 'The resource actor id of the comment author' }),
  author: documentParticipantActorSchema,
  edited_at: v.nullable(v.date({ description: 'When the comment body was last edited' })),
  created_at: v.date(),
  updated_at: v.date()
});

let presentDocumentComment = async (
  d: {
    comment: {
      id: string;
      body: string;
      editedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      resourceActor: Parameters<typeof presentDocumentParticipantActor>[0] & { id: string };
    };
    threadId: string;
  },
  opts: PresenterContext
) => ({
  object: 'document.comment' as const,
  id: d.comment.id,
  thread_id: d.threadId,
  body: d.comment.body,
  author_id: d.comment.resourceActor.id,
  author: await presentDocumentParticipantActor(d.comment.resourceActor, opts),
  edited_at: d.comment.editedAt,
  created_at: d.comment.createdAt,
  updated_at: d.comment.updatedAt
});

export let v1DocumentCommentPresenter = Presenter.create(documentCommentType)
  .presenter(async ({ documentComment, thread }, opts) =>
    presentDocumentComment({ comment: documentComment, threadId: thread.id }, opts)
  )
  .schema(documentCommentSchema)
  .build();

export let v1DocumentCommentThreadPresenter = Presenter.create(documentCommentThreadType)
  .presenter(async ({ documentCommentThread: thread }, opts) => ({
    object: 'document.comment_thread',
    id: thread.id,
    document_id: thread.document.id,
    status: thread.status,
    anchor_status: thread.anchorStatus,
    quote: thread.quote,
    created_by_id: thread.createdByResourceActor.id,
    created_by: await presentDocumentParticipantActor(thread.createdByResourceActor, opts),
    resolved_by_id: thread.resolvedByResourceActor?.id ?? null,
    resolved_by: thread.resolvedByResourceActor
      ? await presentDocumentParticipantActor(thread.resolvedByResourceActor, opts)
      : null,
    resolved_at: thread.resolvedAt,
    comments: await Promise.all(
      thread.comments.map(comment =>
        presentDocumentComment({ comment, threadId: thread.id }, opts)
      )
    ),
    created_at: thread.createdAt,
    updated_at: thread.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('document.comment_thread', {
        description: "String representing the object's type"
      }),
      id: v.string({ description: 'The unique identifier of the comment thread' }),
      document_id: v.string({ description: 'The document the thread is attached to' }),
      status: v.enumOf(['open', 'resolved'], {
        description: 'Whether the discussion is still open'
      }),
      anchor_status: v.enumOf(['attached', 'detached'], {
        description:
          'Whether the commented text still exists in the document. Detached threads lost their text through edits.'
      }),
      quote: v.string({
        description: 'The text that was selected when the thread was created'
      }),
      created_by_id: v.string({ description: 'The resource actor id of the thread author' }),
      created_by: documentParticipantActorSchema,
      resolved_by_id: v.nullable(
        v.string({ description: 'The resource actor id of whoever resolved the thread' })
      ),
      resolved_by: v.nullable(documentParticipantActorSchema),
      resolved_at: v.nullable(v.date({ description: 'When the thread was resolved' })),
      comments: v.array(documentCommentSchema, {
        description: 'The comments in this thread, oldest first'
      }),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
