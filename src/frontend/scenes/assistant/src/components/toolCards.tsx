import React from 'react';
import type { AssistantConversationMessage, AssistantLiveStateItem } from '@metorial/state';
import { Button, Error, Text, theme, useCopy } from '@metorial/ui';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCloseLine,
  RiEditLine,
  RiFileCopyLine
} from '@remixicon/react';
import ReactMarkdown, { type Components } from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
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
import { WebToolCard } from './tools/webTool';
import type { AssistantTranscriptMessageMeta } from './types';

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
  padding: ${p => (p.$tone == 'assistant' ? '0' : '12px 16px')};
  background: ${p =>
    p.$tone == 'user'
      ? `color-mix(in srgb, ${theme.colors.foreground} 4%, ${theme.colors.background})`
      : p.$tone == 'system'
        ? theme.colors.gray100
        : 'transparent'};
  box-shadow: ${p => (p.$tone == 'assistant' ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)')};
`;

let MessageActions = styled.div<{ $tone?: 'user' | 'assistant' | 'system' }>`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: ${p => (p.$tone == 'user' ? 'flex-end' : 'flex-start')};
`;

let SiblingPositionText = styled(Text).attrs({
  size: '1'
})`
  color: color-mix(in srgb, ${theme.colors.foreground} 58%, transparent);
  min-width: 32px;
  text-align: center;
`;

let InlineEditWrap = styled.div`
  width: 80%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let InlineEditInput = styled(TextareaAutosize)`
  width: 100%;
  min-height: 44px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: ${theme.colors.foreground};
  font-size: 14px;
  line-height: 1.6;
  overflow: auto;

  &::placeholder {
    color: color-mix(in srgb, ${theme.colors.foreground} 48%, transparent);
  }
`;

let getCopyValue = (
  parts: Extract<AssistantLiveStateItem, { type: 'message' }>['message']['parts']
) => {
  return parts
    .map(part => {
      if (part.type == 'text') return part.text;
      return part.filename ?? `${part.mediaType} attachment`;
    })
    .join('\n\n')
    .trim();
};

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

let PlainTextWrapper = styled.div`
  font-size: 14px;
  line-height: 1.65;
  color: ${theme.colors.foreground};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
  renderMarkdown?: boolean;
  part:
    | { type: 'text'; text: string }
    | {
        type: 'file';
        filename?: string | undefined;
        mediaType: string;
      };
}) => {
  if (p.part.type == 'text') {
    if (p.renderMarkdown === false) {
      return <PlainTextWrapper>{p.part.text}</PlainTextWrapper>;
    }

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
  messageMeta?: AssistantTranscriptMessageMeta;
  isEditing?: boolean;
  editingValue?: string;
  isSubmittingEdit?: boolean;
  onStartEdit?: (message: AssistantConversationMessage) => void;
  onEditingChange?: (value: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: () => void;
  onSelectReferenceMessage?: (messageId: string) => void;
}) => {
  let role = p.item.message.role;
  let tone: 'user' | 'assistant' | 'system' =
    role == 'user' ? 'user' : role == 'system' ? 'system' : 'assistant';
  let copyValue = getCopyValue(p.item.message.parts);
  let { copied, copy } = useCopy(copyValue);
  let canEdit = role == 'user' && !!p.message;
  let siblingCount = p.messageMeta?.siblingCount ?? 0;
  let canNavigateSiblings = siblingCount > 1;
  let canSubmitEdit = !!p.editingValue?.trim() && !p.isSubmittingEdit;

  return (
    <Row $align={role == 'user' ? 'end' : 'start'}>
      <MessageColumn $tone={tone}>
        <MessageSurface $tone={tone}>
          {p.isEditing && canEdit ? (
            <InlineEditWrap>
              <InlineEditInput
                value={p.editingValue}
                minRows={1}
                maxRows={12}
                placeholder="Edit your message..."
                onChange={event => p.onEditingChange?.(event.currentTarget.value)}
                onKeyDown={event => {
                  if (event.key == 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSubmitEdit) p.onSubmitEdit?.();
                  }
                }}
              />
            </InlineEditWrap>
          ) : (
            <ToolContentStack>
              {p.item.message.parts.map((part, index) => (
                <MessagePart
                  key={`${p.item.id}:${index}`}
                  part={part as any}
                  renderMarkdown={role != 'user'}
                />
              ))}
            </ToolContentStack>
          )}
        </MessageSurface>

        <MessageActions $tone={tone}>
          {canNavigateSiblings && (
            <>
              <Button
                type="button"
                size="1"
                variant="ghost"
                disabled={!p.messageMeta?.previousSibling}
                iconLeft={<RiArrowLeftSLine style={{ opacity: 0.5 }} />}
                onClick={() =>
                  p.messageMeta?.previousSibling &&
                  p.onSelectReferenceMessage?.(p.messageMeta.previousSibling.id)
                }
              />

              <SiblingPositionText>
                {(p.messageMeta?.siblingIndex ?? 0) + 1}/{siblingCount}
              </SiblingPositionText>

              <Button
                type="button"
                size="1"
                variant="ghost"
                disabled={!p.messageMeta?.nextSibling}
                iconLeft={<RiArrowRightSLine style={{ opacity: 0.5 }} />}
                onClick={() =>
                  p.messageMeta?.nextSibling &&
                  p.onSelectReferenceMessage?.(p.messageMeta.nextSibling.id)
                }
              />
            </>
          )}

          {!!copyValue && !p.isEditing && (
            <Button
              type="button"
              size="1"
              variant="ghost"
              iconLeft={
                copied ? (
                  <RiCheckLine style={{ opacity: 0.65 }} />
                ) : (
                  <RiFileCopyLine style={{ opacity: 0.5 }} />
                )
              }
              onClick={() => copy()}
            />
          )}

          {canEdit && !p.isEditing && (
            <Button
              type="button"
              size="1"
              variant="ghost"
              iconLeft={<RiEditLine style={{ opacity: 0.5 }} />}
              onClick={() => p.message && p.onStartEdit?.(p.message)}
            />
          )}

          {p.isEditing && canEdit && (
            <>
              <Button
                type="button"
                size="1"
                variant="ghost"
                iconLeft={<RiCloseLine style={{ opacity: 0.5 }} />}
                onClick={() => p.onCancelEdit?.()}
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="1"
                variant="ghost"
                loading={p.isSubmittingEdit}
                disabled={!canSubmitEdit}
                iconLeft={<RiArrowUpLine style={{ opacity: 0.5 }} />}
                onClick={() => p.onSubmitEdit?.()}
              >
                Send
              </Button>
            </>
          )}
        </MessageActions>
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
  messageMeta?: AssistantTranscriptMessageMeta;
  isEditing?: boolean;
  editingValue?: string;
  isSubmittingEdit?: boolean;
  onStartEdit?: (message: AssistantConversationMessage) => void;
  onEditingChange?: (value: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: () => void;
  onSelectReferenceMessage?: (messageId: string) => void;
}) => {
  if (p.item.type == 'message') {
    return (
      <MessageCard
        item={p.item}
        message={p.message}
        messageMeta={p.messageMeta}
        isEditing={p.isEditing}
        editingValue={p.editingValue}
        isSubmittingEdit={p.isSubmittingEdit}
        onStartEdit={p.onStartEdit}
        onEditingChange={p.onEditingChange}
        onCancelEdit={p.onCancelEdit}
        onSubmitEdit={p.onSubmitEdit}
        onSelectReferenceMessage={p.onSelectReferenceMessage}
      />
    );
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

  if (p.item.type == 'web') {
    return <WebToolCard item={p.item} />;
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
