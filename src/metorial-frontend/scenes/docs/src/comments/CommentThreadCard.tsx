import { confirm, RenderDate } from '@metorial/ui';
import {
  useDocumentCommentThreads,
  type DocumentComment,
  type DocumentCommentThread
} from '@metorial/state';
import { forwardRef, useState } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import { IconCheck, IconTrash } from '../editor/icons';
import { CommentComposer } from './CommentComposer';

export type CommentsAccess = {
  instanceId: string;
  documentId: string;
  actorId: string | null;
  canWrite: boolean;
};

let Card = styled.div<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.color.commentHighlightBorder : theme.color.border)};
  border-radius: 10px;
  background: ${({ theme }) => theme.color.bgElevated};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadow.lg : 'none')};
  cursor: ${({ $active }) => ($active ? 'default' : 'pointer')};
  transition:
    box-shadow ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};
`;

let Quote = styled.blockquote`
  margin: 0;
  padding: 2px 0 2px 10px;
  border-left: 3px solid ${({ theme }) => theme.color.commentHighlightBorder};
  font-size: 12.5px;
  color: ${({ theme }) => theme.color.textMuted};
  white-space: pre-wrap;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

let StatusRow = styled.div`
  display: flex;
  gap: 6px;
`;

let StatusBadge = styled.span<{ $tone: 'muted' | 'warning' }>`
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  color: ${({ $tone, theme }) => ($tone === 'warning' ? theme.color.danger : theme.color.textMuted)};
  background: ${({ theme }) => theme.color.bgActive};
`;

let CommentRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let CommentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

let AuthorMeta = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

let AuthorName = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let Timestamp = styled.span`
  font-size: 11.5px;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let Body = styled.div`
  font-size: 13.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.color.text};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

let IconAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let TextActions = styled.div`
  display: flex;
  gap: 10px;
`;

let TextAction = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: ${({ theme }) => theme.color.textSubtle};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }
`;

let CommentItem = ({
  access,
  thread,
  comment,
  threadActions
}: {
  access: CommentsAccess;
  thread: DocumentCommentThread;
  comment: DocumentComment;
  threadActions?: React.ReactNode;
}) => {
  let threads = useDocumentCommentThreads(access.instanceId, access.documentId);
  let updateComment = threads.useUpdateCommentMutator();
  let deleteComment = threads.useDeleteCommentMutator();
  let [editing, setEditing] = useState(false);
  let isAuthor = !!access.actorId && comment.authorId === access.actorId;

  return (
    <CommentRow>
      <CommentHeader>
        <Avatar
          name={comment.author.name}
          imageUrl={comment.author.imageUrl ?? undefined}
          email={comment.author.email ?? undefined}
          size={24}
          noTooltip
        />
        <AuthorMeta>
          <AuthorName>{comment.author.name}</AuthorName>
          <Timestamp>
            <RenderDate date={comment.createdAt} />
            {comment.editedAt && ' · edited'}
          </Timestamp>
        </AuthorMeta>
        {threadActions}
      </CommentHeader>

      {editing ? (
        <CommentComposer
          label="Edit comment"
          submitLabel="Save"
          initialValue={comment.body}
          autoFocus
          loading={updateComment.isLoading}
          success={updateComment.isSuccess}
          RenderError={updateComment.RenderError}
          onCancel={() => setEditing(false)}
          onSubmit={async body => {
            let [result] = await updateComment.mutate({
              threadId: thread.id,
              commentId: comment.id,
              body
            });
            if (!result) return false;
            setEditing(false);
            return true;
          }}
        />
      ) : (
        <Body>{comment.body}</Body>
      )}

      {isAuthor && !editing && (
        <TextActions>
          <TextAction type="button" onClick={() => setEditing(true)}>
            Edit
          </TextAction>
          <TextAction
            type="button"
            disabled={deleteComment.isLoading}
            onClick={() =>
              confirm({
                title: 'Delete comment?',
                description: 'This comment will be removed for everyone.',
                confirmText: 'Delete',
                onConfirm: () =>
                  void deleteComment.mutate({ threadId: thread.id, commentId: comment.id })
              })
            }
          >
            Delete
          </TextAction>
        </TextActions>
      )}
      <deleteComment.RenderError />
    </CommentRow>
  );
};

export let CommentThreadCard = forwardRef<
  HTMLDivElement,
  {
    access: CommentsAccess;
    thread: DocumentCommentThread;
    active?: boolean;
    showQuote?: boolean;
    onActivate?: (threadId: string) => void;
    style?: React.CSSProperties;
  }
>(({ access, thread, active, showQuote, onActivate, style }, ref) => {
  let threads = useDocumentCommentThreads(access.instanceId, access.documentId);
  let reply = threads.useReplyMutator();
  let updateThread = threads.useUpdateThreadMutator();
  let deleteThread = threads.useDeleteThreadMutator();

  let isThreadAuthor = !!access.actorId && thread.createdById === access.actorId;
  let canResolve = isThreadAuthor || access.canWrite;
  let canReply = !!access.actorId;
  let resolved = thread.status === 'resolved';

  let threadActions = (
    <>
      {canResolve && (
        <IconAction
          type="button"
          title={resolved ? 'Reopen thread' : 'Resolve thread'}
          aria-label={resolved ? 'Reopen thread' : 'Resolve thread'}
          disabled={updateThread.isLoading}
          onClick={event => {
            event.stopPropagation();
            void updateThread.mutate({
              threadId: thread.id,
              status: resolved ? 'open' : 'resolved'
            });
          }}
        >
          <IconCheck />
        </IconAction>
      )}
      {access.canWrite && (
        <IconAction
          type="button"
          title="Delete thread"
          aria-label="Delete thread"
          disabled={deleteThread.isLoading}
          onClick={event => {
            event.stopPropagation();
            confirm({
              title: 'Delete comment thread?',
              description: 'The thread and all replies will be removed for everyone.',
              confirmText: 'Delete',
              onConfirm: () => void deleteThread.mutate({ threadId: thread.id })
            });
          }}
        >
          <IconTrash />
        </IconAction>
      )}
    </>
  );

  return (
    <Card ref={ref} style={style} $active={active} onClick={() => onActivate?.(thread.id)}>
      {(resolved || thread.anchorStatus === 'detached') && (
        <StatusRow>
          {resolved && <StatusBadge $tone="muted">Resolved</StatusBadge>}
          {thread.anchorStatus === 'detached' && (
            <StatusBadge $tone="warning">Text removed</StatusBadge>
          )}
        </StatusRow>
      )}
      {showQuote && <Quote>{thread.quote}</Quote>}

      {thread.comments.map((comment, index) => (
        <CommentItem
          key={comment.id}
          access={access}
          thread={thread}
          comment={comment}
          threadActions={index === 0 ? threadActions : undefined}
        />
      ))}
      {thread.comments.length === 0 && threadActions}

      <updateThread.RenderError />
      <deleteThread.RenderError />

      {active && canReply && (
        <CommentComposer
          label="Reply"
          submitLabel="Reply"
          loading={reply.isLoading}
          success={reply.isSuccess}
          RenderError={reply.RenderError}
          onSubmit={async body => {
            let [result] = await reply.mutate({ threadId: thread.id, body });
            return !!result;
          }}
        />
      )}
    </Card>
  );
});
