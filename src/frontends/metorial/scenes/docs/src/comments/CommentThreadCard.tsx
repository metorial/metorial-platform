import { Button, confirm, Menu } from '@metorial/ui';
import { RiCheckLine, RiCloseLine, RiInboxUnarchiveLine, RiMore2Line } from '@remixicon/react';
import {
  useDocumentCommentThreads,
  type DocumentComment,
  type DocumentCommentThread
} from '@metorial/state';
import { forwardRef, useState } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import { CommentBody } from './CommentBody';
import { CommentComposer } from './CommentComposer';

export type CommentsAccess = {
  instanceId: string;
  documentId: string;
  actorId: string | null;
  canWrite: boolean;
};

let formatCommentTime = (value: string | Date) => {
  let date = new Date(value);
  let seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

let ReplyButtonWrap = styled.div`
  position: absolute;
  right: 14px;
  bottom: -14px;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity ${({ theme }) => theme.motion.fast};
`;

let Card = styled.div<{ $active?: boolean; $floating?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.color.borderStrong : theme.color.border)};
  border-radius: ${({ theme }) => theme.size.radiusLg};
  background: ${({ theme }) => theme.color.bgElevated};
  box-shadow: ${({ $floating, theme }) => ($floating ? theme.shadow.sm : 'none')};
  cursor: ${({ $active }) => ($active ? 'default' : 'pointer')};
  transition:
    box-shadow ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};

  &:hover {
    border-color: ${({ theme }) => theme.color.borderStrong};
  }

  &:hover ${ReplyButtonWrap}, &:focus-within ${ReplyButtonWrap} {
    opacity: 1;
    pointer-events: auto;
  }
`;

let ReplyDivider = styled.div`
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.color.border};
`;

let Quote = styled.div<{ $detached?: boolean }>`
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: ${({ theme }) => theme.color.bgAlt};
  box-shadow: inset 0 0 0 1px ${({ theme }) => theme.color.border};
  font-size: 12.5px;
  line-height: 1.45;
  color: ${({ theme }) => theme.color.textMuted};
  text-decoration: ${({ $detached }) => ($detached ? 'line-through' : 'none')};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

let CommentRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  line-height: 1.3;
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

let CommentItem = ({
  access,
  thread,
  comment,
  resolveButton,
  closeButton,
  onDeleteThread
}: {
  access: CommentsAccess;
  thread: DocumentCommentThread;
  comment: DocumentComment;
  resolveButton?: React.ReactNode;
  closeButton?: React.ReactNode;
  onDeleteThread?: () => void;
}) => {
  let threads = useDocumentCommentThreads(access.instanceId, access.documentId);
  let updateComment = threads.useUpdateCommentMutator();
  let deleteComment = threads.useDeleteCommentMutator();
  let [editing, setEditing] = useState(false);
  let isAuthor = !!access.actorId && comment.authorId === access.actorId;

  let menuItems = [
    ...(isAuthor
      ? [
          { id: 'edit', label: 'Edit' },
          { id: 'delete', label: 'Delete comment' }
        ]
      : []),
    ...(onDeleteThread ? [{ id: 'delete-thread', label: 'Delete thread' }] : [])
  ];

  let onMenuItem = (id: string) => {
    if (id === 'edit') setEditing(true);
    if (id === 'delete') {
      confirm({
        title: 'Delete comment?',
        description: 'This comment will be removed for everyone.',
        confirmText: 'Delete',
        onConfirm: () =>
          void deleteComment.mutate({ threadId: thread.id, commentId: comment.id })
      });
    }
    if (id === 'delete-thread') onDeleteThread?.();
  };

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
          <Timestamp title={new Date(comment.createdAt).toLocaleString()}>
            {formatCommentTime(comment.createdAt)}
            {comment.editedAt && ' · edited'}
          </Timestamp>
        </AuthorMeta>
        <HeaderActions onClick={event => event.stopPropagation()}>
          {resolveButton}
          {menuItems.length > 0 && !editing && (
            <Menu items={menuItems} onItemClick={onMenuItem}>
              <Button
                size="1"
                variant="outline"
                aria-label="Comment options"
                iconRight={<RiMore2Line />}
                loading={deleteComment.isLoading}
              />
            </Menu>
          )}
          {closeButton}
        </HeaderActions>
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
        <CommentBody markdown={comment.body} />
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
    floating?: boolean;
    onActivate?: (threadId: string) => void;
    onClose?: (threadId: string) => void;
    style?: React.CSSProperties;
  }
>(({ access, thread, active, showQuote, floating, onActivate, onClose, style }, ref) => {
  let [replying, setReplying] = useState(false);
  let threads = useDocumentCommentThreads(access.instanceId, access.documentId);
  let reply = threads.useReplyMutator();
  let updateThread = threads.useUpdateThreadMutator();
  let deleteThread = threads.useDeleteThreadMutator();

  let isThreadAuthor = !!access.actorId && thread.createdById === access.actorId;
  let canResolve = isThreadAuthor || access.canWrite;
  let canReply = !!access.actorId;
  let resolved = thread.status === 'resolved';

  let closeButton = onClose ? (
    <Button
      size="1"
      variant="outline"
      title="Hide thread"
      aria-label="Hide thread"
      iconRight={<RiCloseLine />}
      onClick={() => onClose(thread.id)}
    />
  ) : null;

  let confirmDeleteThread = () =>
    confirm({
      title: 'Delete comment thread?',
      description: 'The thread and all replies will be removed for everyone.',
      confirmText: 'Delete',
      onConfirm: () => void deleteThread.mutate({ threadId: thread.id })
    });

  let resolveButton = canResolve ? (
    <Button
      size="1"
      variant="outline"
      title={resolved ? 'Reopen thread' : 'Resolve thread'}
      aria-label={resolved ? 'Reopen thread' : 'Resolve thread'}
      iconRight={resolved ? <RiInboxUnarchiveLine /> : <RiCheckLine />}
      disabled={updateThread.isLoading}
      onClick={() =>
        void updateThread.mutate({
          threadId: thread.id,
          status: resolved ? 'open' : 'resolved'
        })
      }
    />
  ) : null;

  return (
    <Card
      ref={ref}
      style={style}
      $active={active}
      $floating={floating}
      onClick={() => onActivate?.(thread.id)}>
      {showQuote && (
        <Quote $detached={thread.anchorStatus === 'detached'}>{thread.quote}</Quote>
      )}

      {thread.comments.map((comment, index) => (
        <CommentItem
          key={comment.id}
          access={access}
          thread={thread}
          comment={comment}
          resolveButton={index === 0 ? resolveButton : undefined}
          closeButton={index === 0 ? closeButton : undefined}
          onDeleteThread={index === 0 && access.canWrite ? confirmDeleteThread : undefined}
        />
      ))}

      <updateThread.RenderError />
      <deleteThread.RenderError />

      {replying && canReply && (
        <ReplyDivider>
          <CommentComposer
            label="Reply"
            submitLabel="Reply"
            bare
            autoFocus
            loading={reply.isLoading}
            success={reply.isSuccess}
            RenderError={reply.RenderError}
            onCancel={() => setReplying(false)}
            onSubmit={async body => {
              let [result] = await reply.mutate({ threadId: thread.id, body });
              if (!result) return false;
              setReplying(false);
              return true;
            }}
          />
        </ReplyDivider>
      )}

      {!replying && canReply && (
        <ReplyButtonWrap>
          <Button
            size="1"
            onClick={event => {
              event.stopPropagation();
              setReplying(true);
            }}
          >
            Reply
          </Button>
        </ReplyButtonWrap>
      )}
    </Card>
  );
});
