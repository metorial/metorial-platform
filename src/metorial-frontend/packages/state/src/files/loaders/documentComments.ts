import type {
  DashboardInstanceDocumentsCommentThreadsCommentsCreateBody,
  DashboardInstanceDocumentsCommentThreadsCommentsUpdateBody,
  DashboardInstanceDocumentsCommentThreadsCreateBody,
  DashboardInstanceDocumentsCommentThreadsGetOutput,
  DashboardInstanceDocumentsCommentThreadsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export type DocumentCommentThread = DashboardInstanceDocumentsCommentThreadsGetOutput;
export type DocumentComment = DocumentCommentThread['comments'][number];

type DocumentCommentsInput = { input: { instanceId: string; documentId: string } };

export let documentCommentThreadsLoader = createLoader({
  name: 'documentCommentThreads',
  parents: [],
  fetch: (i: { instanceId: string; documentId: string }) =>
    withAuth(sdk =>
      sdk.documents.commentThreads.list(i.instanceId, i.documentId, {
        limit: 100,
        order: 'asc'
      })
    ),
  mutators: {
    createThread: (
      body: DashboardInstanceDocumentsCommentThreadsCreateBody,
      { input }: DocumentCommentsInput
    ) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.create(input.instanceId, input.documentId, body)
      ),

    updateThread: (
      d: DashboardInstanceDocumentsCommentThreadsUpdateBody & { threadId: string },
      { input }: DocumentCommentsInput
    ) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.update(input.instanceId, input.documentId, d.threadId, {
          status: d.status
        })
      ),

    deleteThread: (d: { threadId: string }, { input }: DocumentCommentsInput) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.delete(input.instanceId, input.documentId, d.threadId)
      ),

    reply: (
      d: DashboardInstanceDocumentsCommentThreadsCommentsCreateBody & { threadId: string },
      { input }: DocumentCommentsInput
    ) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.comments.create(
          input.instanceId,
          input.documentId,
          d.threadId,
          { body: d.body }
        )
      ),

    updateComment: (
      d: DashboardInstanceDocumentsCommentThreadsCommentsUpdateBody & {
        threadId: string;
        commentId: string;
      },
      { input }: DocumentCommentsInput
    ) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.comments.update(
          input.instanceId,
          input.documentId,
          d.threadId,
          d.commentId,
          { body: d.body }
        )
      ),

    deleteComment: (
      d: { threadId: string; commentId: string },
      { input }: DocumentCommentsInput
    ) =>
      withAuth(sdk =>
        sdk.documents.commentThreads.comments.delete(
          input.instanceId,
          input.documentId,
          d.threadId,
          d.commentId
        )
      )
  }
});

export let useDocumentCommentThreads = (
  instanceId: string | null | undefined,
  documentId: string | null | undefined
) => {
  let data = documentCommentThreadsLoader.use(
    instanceId && documentId ? { instanceId, documentId } : null
  );

  return {
    ...data,
    useCreateThreadMutator: data.useMutator('createThread'),
    useUpdateThreadMutator: data.useMutator('updateThread'),
    useDeleteThreadMutator: data.useMutator('deleteThread'),
    useReplyMutator: data.useMutator('reply'),
    useUpdateCommentMutator: data.useMutator('updateComment'),
    useDeleteCommentMutator: data.useMutator('deleteComment')
  };
};
