import type { DocumentCommentThread } from '@metorial/state';
import { OptionToggle, Panel } from '@metorial/ui';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDismissEditorOverlays } from '../editor/overlays';
import { CommentThreadCard, type CommentsAccess } from './CommentThreadCard';

type CommentsFilter = 'all' | 'open' | 'resolved';

let filters: { id: CommentsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' }
];

let matchesFilter = (thread: DocumentCommentThread, filter: CommentsFilter) => {
  if (filter === 'open') return thread.status === 'open';
  if (filter === 'resolved') return thread.status === 'resolved';
  return true;
};

let FilterWrap = styled.div`
  margin-bottom: 16px;
`;

let List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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
        <Panel.Title>Comments</Panel.Title>
      </Panel.Header>
      <Panel.Content>
        <FilterWrap>
          <OptionToggle
            ariaLabel="Filter comments"
            value={filter}
            onChange={value => setFilter(value as CommentsFilter)}
            items={filters.map(option => ({ id: option.id, label: option.label }))}
            size="2"
            itemMinWidth={0}
            fullWidth
          />
        </FilterWrap>

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
