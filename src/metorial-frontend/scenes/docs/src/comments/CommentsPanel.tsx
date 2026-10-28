import type { DocumentCommentThread } from '@metorial/state';
import { Panel } from '@metorial/ui';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDismissEditorOverlays } from '../editor/overlays';
import { CommentThreadCard, type CommentsAccess } from './CommentThreadCard';

type CommentsFilter = 'all' | 'open' | 'resolved' | 'detached';

let filters: { id: CommentsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'detached', label: 'Text removed' }
];

let matchesFilter = (thread: DocumentCommentThread, filter: CommentsFilter) => {
  if (filter === 'open') return thread.status === 'open' && thread.anchorStatus === 'attached';
  if (filter === 'resolved') return thread.status === 'resolved';
  if (filter === 'detached') return thread.anchorStatus === 'detached';
  return true;
};

let HeaderTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
`;

let HeaderCount = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.textMuted};
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.color.bgAlt};
`;

let FilterBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 2px;
  margin-bottom: 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.color.bgAlt};
`;

let FilterButton = styled.button<{ $active?: boolean }>`
  flex: 1;
  height: 28px;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.color.text : theme.color.textMuted)};
  background: ${({ $active, theme }) => ($active ? theme.color.bgElevated : 'transparent')};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadow.sm : 'none')};
`;

let List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
`;

let EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: ${({ theme }) => theme.color.textMuted};
  font-size: 13px;
`;

export let CommentsPanel = ({
  open,
  onOpenChange,
  access,
  threads,
  activeThreadId,
  onSelectThread
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: CommentsAccess;
  threads: DocumentCommentThread[];
  activeThreadId: string | null;
  onSelectThread: (thread: DocumentCommentThread) => void;
}) => {
  useDismissEditorOverlays(open);
  let [filter, setFilter] = useState<CommentsFilter>('open');

  let visible = useMemo(
    () =>
      threads
        .filter(thread => matchesFilter(thread, filter))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [filter, threads]
  );

  return (
    <Panel.Wrapper isOpen={open} onOpenChange={onOpenChange} width={440}>
      <Panel.Header>
        <HeaderTitle>
          Comments
          <HeaderCount>
            {threads.filter(thread => matchesFilter(thread, 'open')).length}
          </HeaderCount>
        </HeaderTitle>
      </Panel.Header>
      <Panel.Content>
        <FilterBar role="tablist" aria-label="Filter comments">
          {filters.map(option => (
            <FilterButton
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              $active={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </FilterButton>
          ))}
        </FilterBar>

        <List>
          {visible.length === 0 ? (
            <EmptyState>
              {threads.length === 0
                ? 'No comments yet. Select text in the document to start a discussion.'
                : 'No comments match this filter.'}
            </EmptyState>
          ) : (
            visible.map(thread => (
              <CommentThreadCard
                key={thread.id}
                access={access}
                thread={thread}
                active={thread.id === activeThreadId}
                showQuote
                onActivate={() => onSelectThread(thread)}
              />
            ))
          )}
        </List>
      </Panel.Content>
    </Panel.Wrapper>
  );
};
