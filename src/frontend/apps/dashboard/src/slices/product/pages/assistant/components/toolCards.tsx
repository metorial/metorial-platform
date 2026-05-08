import type { AssistantConversationMessage, AssistantLiveStateItem } from '@metorial/state';
import { Error, Text, theme } from '@metorial/ui';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styled from 'styled-components';
import { TextShimmer } from './textShimmer';
import { BashToolCard } from './tools/bashTool';
import { EditToolCard } from './tools/editTool';
import { McpToolCard } from './tools/mcpTool';
import { SearchToolCard } from './tools/searchTool';
import {
  getStatusLabel,
  ToolContentStack,
  ToolDetail,
  ToolHeader,
  ToolHeaderMain,
  ToolPathTag,
  ToolStatusBadge,
  ToolSurfaceCard,
  ToolTitle
} from './tools/shared';

let Row = styled.div<{ $align?: 'start' | 'end' }>`
  display: flex;
  width: 100%;
  justify-content: ${p => (p.$align == 'end' ? 'flex-end' : 'flex-start')};
`;

let MessageColumn = styled.div<{ $tone?: 'user' | 'assistant' | 'system' }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: min(760px, 92%);
  align-items: ${p => (p.$tone == 'user' ? 'flex-end' : 'flex-start')};
`;

let MessageSurface = styled.div<{ $tone?: 'user' | 'assistant' | 'system' }>`
  width: ${p => (p.$tone == 'assistant' ? '100%' : 'auto')};
  max-width: 100%;
  border-radius: ${p => (p.$tone == 'user' ? '20px' : '16px')};
  padding: ${p => (p.$tone == 'assistant' ? '0' : '12px 14px')};
  background: ${p =>
    p.$tone == 'user'
      ? `color-mix(in srgb, ${theme.colors.foreground} 4%, ${theme.colors.background})`
      : p.$tone == 'system'
        ? theme.colors.gray100
        : 'transparent'};
  border: ${p =>
    p.$tone == 'assistant'
      ? 'none'
      : `1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent)`};
  box-shadow: ${p => (p.$tone == 'assistant' ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)')};
`;

let MessageMeta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

let MetaLabel = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
  font-weight: 500;
`;

let MarkdownWrapper = styled.div`
  font-size: 14px;
  line-height: 1.65;
  color: ${theme.colors.foreground};

  p {
    margin: 0 0 12px;
  }

  p:last-child {
    margin-bottom: 0;
  }

  ul,
  ol {
    padding-left: 18px;
    margin: 0 0 12px;
  }

  li + li {
    margin-top: 4px;
  }

  code {
    font-family: 'Source Code Pro', monospace;
    background: color-mix(in srgb, ${theme.colors.foreground} 6%, transparent);
    padding: 2px 5px;
    border-radius: 5px;
  }

  pre code {
    background: transparent;
    padding: 0;
  }
`;

let MarkdownTableScroll = styled.div`
  overflow-x: auto;
  margin: 0 0 12px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, ${theme.colors.foreground} 2%, ${theme.colors.background});
`;

let MarkdownTable = styled.table`
  width: 100%;
  min-width: 480px;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.5;
`;

let MarkdownTableHeadCell = styled.th`
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  font-weight: 600;
  color: ${theme.colors.foreground};
  background: color-mix(in srgb, ${theme.colors.foreground} 4%, ${theme.colors.background});
`;

let MarkdownTableCell = styled.td`
  padding: 10px 12px;
  vertical-align: top;
  border-top: 1px solid color-mix(in srgb, ${theme.colors.foreground} 8%, transparent);
`;

let markdownComponents: Components = {
  table: ({ children, ...props }) => (
    <MarkdownTableScroll>
      <MarkdownTable {...props}>{children}</MarkdownTable>
    </MarkdownTableScroll>
  ),
  th: ({ children, ...props }) => (
    <MarkdownTableHeadCell {...props}>{children}</MarkdownTableHeadCell>
  ),
  td: ({ children, ...props }) => <MarkdownTableCell {...props}>{children}</MarkdownTableCell>
};

let MessagePart = (p: {
  part:
    | { type: 'text'; text: string }
    | {
        type: 'file';
        filename?: string | undefined;
        mediaType: string;
      };
}) => {
  if (p.part.type == 'text') {
    return (
      <MarkdownWrapper>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {p.part.text}
        </ReactMarkdown>
      </MarkdownWrapper>
    );
  }

  return (
    <ToolPathTag>
      {p.part.filename ?? 'Attachment'} · {p.part.mediaType}
    </ToolPathTag>
  );
};

let MessageCard = (p: {
  item: Extract<AssistantLiveStateItem, { type: 'message' }>;
  message?: AssistantConversationMessage;
}) => {
  let role = p.item.message.role;
  let showStatus = role != 'user' && p.item.status != 'completed';
  let tone: 'user' | 'assistant' | 'system' =
    role == 'user' ? 'user' : role == 'system' ? 'system' : 'assistant';

  return (
    <Row $align={role == 'user' ? 'end' : 'start'}>
      <MessageColumn $tone={tone}>
        {(role == 'assistant' || role == 'system' || showStatus) && (
          <MessageMeta>
            {showStatus && (
              <ToolStatusBadge $status={p.item.status}>
                {getStatusLabel(p.item.status)}
              </ToolStatusBadge>
            )}
          </MessageMeta>
        )}

        <MessageSurface $tone={tone}>
          <ToolContentStack>
            {p.item.message.parts.map((part, index) => (
              <MessagePart key={`${p.item.id}:${index}`} part={part as any} />
            ))}
          </ToolContentStack>
        </MessageSurface>
      </MessageColumn>
    </Row>
  );
};

let ReasoningCard = (p: { item: Extract<AssistantLiveStateItem, { type: 'reasoning' }> }) => {
  return (
    <ToolSurfaceCard>
      <ToolHeader>
        <ToolHeaderMain>
          <ToolTitle>Thinking</ToolTitle>
          {!!p.item.text && p.item.status == 'running' && (
            <ToolDetail>{p.item.text}</ToolDetail>
          )}
        </ToolHeaderMain>
        {p.item.status != 'completed' ? (
          <ToolStatusBadge $status={p.item.status}>
            {getStatusLabel(p.item.status)}
          </ToolStatusBadge>
        ) : null}
      </ToolHeader>

      {p.item.status == 'running' ? (
        <TextShimmer>{p.item.text || 'Thinking...'}</TextShimmer>
      ) : (
        <MarkdownWrapper>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {p.item.text}
          </ReactMarkdown>
        </MarkdownWrapper>
      )}
    </ToolSurfaceCard>
  );
};

let CompactionCard = (p: {
  item: Extract<AssistantLiveStateItem, { type: 'compaction' }>;
}) => {
  return (
    <ToolSurfaceCard>
      <ToolHeader>
        <ToolHeaderMain>
          <ToolTitle>Compaction</ToolTitle>
          <ToolDetail>{p.item.summary ?? 'Compressing conversation history.'}</ToolDetail>
        </ToolHeaderMain>
        {p.item.status != 'completed' ? (
          <ToolStatusBadge $status={p.item.status}>
            {getStatusLabel(p.item.status)}
          </ToolStatusBadge>
        ) : null}
      </ToolHeader>
    </ToolSurfaceCard>
  );
};

export let AssistantStateItemCard = (p: {
  item: AssistantLiveStateItem;
  message?: AssistantConversationMessage;
}) => {
  if (p.item.type == 'message') {
    return <MessageCard item={p.item} message={p.message} />;
  }

  if (p.item.type == 'reasoning') {
    return <ReasoningCard item={p.item} />;
  }

  if (p.item.type == 'files/write') {
    return <EditToolCard item={p.item} />;
  }

  if (p.item.type == 'shell') {
    return <BashToolCard item={p.item} />;
  }

  if (p.item.type == 'files/explore') {
    return <SearchToolCard item={p.item} />;
  }

  if (p.item.type == 'tool') {
    return <McpToolCard item={p.item} />;
  }

  if (p.item.type == 'error') {
    return <Error>{p.item.error.message}</Error>;
  }

  if (p.item.type == 'compaction') {
    return <CompactionCard item={p.item} />;
  }

  return null;
};
