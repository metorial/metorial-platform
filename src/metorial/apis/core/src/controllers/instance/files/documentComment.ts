import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  documentCommentService,
  documentCommentThreadService
} from '@metorial/module-documents';
import {
  documentCommentPresenter,
  documentCommentThreadPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import type { Document } from '@metorial/db';
import {
  getInstanceCargoAccess,
  type InstanceCargoAccessContext
} from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { stringArrayFilterSchema } from './_listFilters';
import { documentGroup } from './document';

let readScopes = checkAccess({
  possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
});

let threadStatusSchema = v.enumOf(['open', 'resolved']);
let anchorStatusSchema = v.enumOf(['attached', 'detached']);

let getCommentAccess = async (ctx: InstanceCargoAccessContext & { document: Document }) => {
  let access = await getInstanceCargoAccess(ctx);

  return {
    project: access.project,
    instance: access.instance,
    document: ctx.document,
    authorization: access.authorization,
    defaultPermissions: access.defaultPermissions,
    overridePermissions: access.overridePermissions,
    auditScope: access.auditScope
  };
};

export let documentCommentThreadGroup = documentGroup.use(async ctx => {
  if (!ctx.params.documentCommentThreadId) {
    throw new Error('documentCommentThreadId is required');
  }

  let documentCommentThread = await documentCommentThreadService.getDocumentCommentThreadById({
    ...(await getCommentAccess(ctx)),
    threadId: ctx.params.documentCommentThreadId
  });

  return { documentCommentThread };
});

export let documentCommentGroup = documentCommentThreadGroup.use(async ctx => {
  if (!ctx.params.documentCommentId) {
    throw new Error('documentCommentId is required');
  }

  let documentComment = await documentCommentService.getDocumentCommentById({
    ...(await getCommentAccess(ctx)),
    thread: ctx.documentCommentThread,
    commentId: ctx.params.documentCommentId
  });

  return { documentComment };
});

export let documentCommentThreadController = Controller.create(
  {
    name: 'Document Comment Threads',
    description: 'Discuss selected text in a document through comment threads.'
  },
  {
    list: documentGroup
      .get(
        instancePath('documents/:documentId/comment-threads', 'documents.commentThreads.list'),
        {
          name: 'List document comment threads',
          description: 'Returns a paginated list of comment threads for a specific document.'
        }
      )
      .use(readScopes)
      .outputList(documentCommentThreadPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Filter by comment thread ID'),
            status: v.optional(v.union([threadStatusSchema, v.array(threadStatusSchema)]), {
              description: 'Filter by thread status'
            }),
            anchor_status: v.optional(
              v.union([anchorStatusSchema, v.array(anchorStatusSchema)]),
              { description: 'Filter by whether the commented text still exists' }
            ),
            created_at: dateFilterValidator('Filter by creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await documentCommentThreadService.listDocumentCommentThreads({
          ...(await getCommentAccess(ctx)),
          ids: normalizeArrayParam(ctx.query.id),
          statuses: normalizeArrayParam(ctx.query.status),
          anchorStatuses: normalizeArrayParam(ctx.query.anchor_status),
          createdAt: ctx.query.created_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, documentCommentThread =>
          documentCommentThreadPresenter.present({ documentCommentThread })
        );
      }),

    get: documentCommentThreadGroup
      .get(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId',
          'documents.commentThreads.get'
        ),
        {
          name: 'Get document comment thread by ID',
          description: 'Retrieves a specific comment thread with its comments.'
        }
      )
      .use(readScopes)
      .output(documentCommentThreadPresenter)
      .do(async ctx =>
        documentCommentThreadPresenter.present({
          documentCommentThread: ctx.documentCommentThread
        })
      ),

    create: documentGroup
      .post(
        instancePath(
          'documents/:documentId/comment-threads',
          'documents.commentThreads.create'
        ),
        {
          name: 'Create document comment thread',
          description:
            'Starts a comment thread on a text selection. Anyone who can read the document can comment.'
        }
      )
      .use(readScopes)
      .body(
        'default',
        v.object({
          anchor: v.object(
            {
              start_block_id: v.string({ description: 'Block id where the selection starts' }),
              start_offset: v.number({
                description: 'Text offset inside the start block',
                modifiers: [v.integer(), v.minValue(0)]
              }),
              end_block_id: v.string({ description: 'Block id where the selection ends' }),
              end_offset: v.number({
                description: 'Text offset inside the end block',
                modifiers: [v.integer(), v.minValue(0)]
              }),
              quote: v.string({ description: 'The selected text' })
            },
            { description: 'The text selection the thread is attached to' }
          ),
          body: v.string({ description: 'The first comment in the thread' })
        })
      )
      .output(documentCommentThreadPresenter)
      .do(async ctx => {
        let documentCommentThread =
          await documentCommentThreadService.createDocumentCommentThread({
            ...(await getCommentAccess(ctx)),
            input: {
              anchor: {
                startBlockId: ctx.body.anchor.start_block_id,
                startOffset: ctx.body.anchor.start_offset,
                endBlockId: ctx.body.anchor.end_block_id,
                endOffset: ctx.body.anchor.end_offset,
                quote: ctx.body.anchor.quote
              },
              body: ctx.body.body
            }
          });

        return documentCommentThreadPresenter.present({ documentCommentThread });
      }),

    update: documentCommentThreadGroup
      .patch(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId',
          'documents.commentThreads.update'
        ),
        {
          name: 'Update document comment thread',
          description:
            'Resolves or reopens a comment thread. Allowed for the thread author and document editors.'
        }
      )
      .use(readScopes)
      .body(
        'default',
        v.object({
          status: v.optional(threadStatusSchema)
        })
      )
      .output(documentCommentThreadPresenter)
      .do(async ctx => {
        let documentCommentThread =
          await documentCommentThreadService.updateDocumentCommentThread({
            ...(await getCommentAccess(ctx)),
            thread: ctx.documentCommentThread,
            input: { status: ctx.body.status }
          });

        return documentCommentThreadPresenter.present({ documentCommentThread });
      }),

    delete: documentCommentThreadGroup
      .delete(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId',
          'documents.commentThreads.delete'
        ),
        {
          name: 'Delete document comment thread',
          description:
            'Deletes a comment thread and removes its highlight. Requires document write access.'
        }
      )
      .use(readScopes)
      .output(documentCommentThreadPresenter)
      .do(async ctx => {
        let documentCommentThread =
          await documentCommentThreadService.deleteDocumentCommentThread({
            ...(await getCommentAccess(ctx)),
            thread: ctx.documentCommentThread
          });

        return documentCommentThreadPresenter.present({ documentCommentThread });
      })
  }
);

export let documentCommentController = Controller.create(
  {
    name: 'Document Comments',
    description: 'Reply to, edit, and delete comments in a document comment thread.'
  },
  {
    create: documentCommentThreadGroup
      .post(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId/comments',
          'documents.commentThreads.comments.create'
        ),
        {
          name: 'Reply to document comment thread',
          description: 'Adds a comment to an existing comment thread.'
        }
      )
      .use(readScopes)
      .body(
        'default',
        v.object({
          body: v.string({ description: 'The comment body' })
        })
      )
      .output(documentCommentPresenter)
      .do(async ctx => {
        let documentComment = await documentCommentService.createDocumentComment({
          ...(await getCommentAccess(ctx)),
          thread: ctx.documentCommentThread,
          input: { body: ctx.body.body }
        });

        return documentCommentPresenter.present({
          documentComment,
          thread: ctx.documentCommentThread
        });
      }),

    update: documentCommentGroup
      .patch(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId/comments/:documentCommentId',
          'documents.commentThreads.comments.update'
        ),
        {
          name: 'Update document comment',
          description: 'Edits a comment. Only the comment author can edit it.'
        }
      )
      .use(readScopes)
      .body(
        'default',
        v.object({
          body: v.string({ description: 'The new comment body' })
        })
      )
      .output(documentCommentPresenter)
      .do(async ctx => {
        let documentComment = await documentCommentService.updateDocumentComment({
          ...(await getCommentAccess(ctx)),
          thread: ctx.documentCommentThread,
          comment: ctx.documentComment,
          input: { body: ctx.body.body }
        });

        return documentCommentPresenter.present({
          documentComment,
          thread: ctx.documentCommentThread
        });
      }),

    delete: documentCommentGroup
      .delete(
        instancePath(
          'documents/:documentId/comment-threads/:documentCommentThreadId/comments/:documentCommentId',
          'documents.commentThreads.comments.delete'
        ),
        {
          name: 'Delete document comment',
          description: 'Deletes a comment. Only the comment author can delete it.'
        }
      )
      .use(readScopes)
      .output(documentCommentPresenter)
      .do(async ctx => {
        let documentComment = await documentCommentService.deleteDocumentComment({
          ...(await getCommentAccess(ctx)),
          thread: ctx.documentCommentThread,
          comment: ctx.documentComment
        });

        return documentCommentPresenter.present({
          documentComment,
          thread: ctx.documentCommentThread
        });
      })
  }
);
