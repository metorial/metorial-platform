import type { AgentBlockStatus } from '@metorial/docs-editor-schema';
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { IconArrowRight, IconClose, IconSparkle } from '../icons';
import { useDocsAgent } from './DocsAgentProvider';

let Wrap = styled(NodeViewWrapper)`
  margin: 12px 0;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  background: ${({ theme }) => theme.color.bg};
  overflow: hidden;

  &[data-status='idle'] {
    border-color: #ddd;
    box-shadow: 0 1px 3px rgba(15, 15, 15, 0.06);
  }

  &[data-status='running'] {
    border-color: ${({ theme }) => theme.color.accent};
  }

  &[data-status='review'] {
    border-color: ${({ theme }) => theme.color.accent};
    background: ${({ theme }) => theme.color.accentSoft};
  }

  &[data-status='error'] {
    border-color: ${({ theme }) => theme.color.danger};
  }
`;

let Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bgAlt};
  font-family: ${({ theme }) => theme.font.sans};
  font-size: 13px;
  user-select: none;
`;

let Label = styled.span`
  flex: 0 0 auto;
  font-weight: 600;
  color: ${({ theme }) => theme.color.text};
`;

let Detail = styled.span<{ $error?: boolean }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $error, theme }) => ($error ? theme.color.danger : theme.color.textMuted)};
`;

let Composer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 10px 10px 14px;
  font-family: ${({ theme }) => theme.font.sans};
`;

let ComposerIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  margin-top: 3px;
  color: ${({ theme }) => theme.color.accent};

  svg {
    width: 16px;
    height: 16px;
  }
`;

let PromptInput = styled.textarea`
  flex: 1;
  min-width: 0;
  min-height: 24px;
  max-height: 240px;
  padding: 2px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 15px;
  line-height: 1.5;
  resize: none;
  outline: none;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let ActionButton = styled.button<{ $primary?: boolean }>`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid
    ${({ $primary, theme }) => ($primary ? theme.color.text : theme.color.border)};
  border-radius: 6px;
  background: ${({ $primary, theme }) => ($primary ? theme.color.text : theme.color.bg)};
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }

  &&& {
    color: ${({ $primary, theme }) => ($primary ? theme.color.bg : theme.color.text)};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

let IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Content = styled(NodeViewContent)`
  padding: 4px 14px;

  &[data-hidden='true'] {
    display: none;
  }
`;

export let AgentBlockView = ({ node, editor }: ReactNodeViewProps) => {
  let agent = useDocsAgent();
  let blockId = node.attrs.blockId as string | null;
  let status = node.attrs.status as AgentBlockStatus;
  let mode = node.attrs.mode as 'block' | 'summarize';
  let job = blockId ? agent?.jobs[blockId] : undefined;
  let canAct = !!agent?.canWrite && editor.isEditable && !!blockId;

  let [prompt, setPrompt] = useState((node.attrs.prompt as string) ?? '');
  let inputRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    let el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt, status]);

  useEffect(() => {
    setPrompt((node.attrs.prompt as string) ?? '');
  }, [node.attrs.prompt]);

  useEffect(() => {
    if (status == 'idle' && blockId && agent?.focusBlockId == blockId) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [agent?.focusBlockId, blockId, status]);

  let submit = () => {
    if (!blockId || !prompt.trim()) return;
    agent?.runBlock(blockId, prompt.trim());
  };

  let label = mode == 'summarize' ? 'Summary' : 'AI writing';
  let isEmpty = node.textContent.trim().length == 0;

  let showComposer = status == 'idle' && canAct;

  return (
    <Wrap data-agent-block="true" data-status={status}>
      {showComposer && (
        <Composer contentEditable={false}>
          <ComposerIcon>
            <IconSparkle />
          </ComposerIcon>
          <PromptInput
            ref={inputRef}
            rows={1}
            value={prompt}
            placeholder="Ask AI to write something, e.g. “Explain how retries work in two paragraphs”"
            onChange={event => setPrompt(event.target.value)}
            onKeyDown={event => {
              event.stopPropagation();
              if (event.key == 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <ActionButton type="button" $primary disabled={!prompt.trim()} onClick={submit}>
            <IconArrowRight />
          </ActionButton>
          <IconButton
            type="button"
            aria-label="Remove"
            title="Remove"
            onClick={() => agent?.remove(blockId!)}
          >
            <IconClose />
          </IconButton>
        </Composer>
      )}

      {!showComposer && (
        <Header contentEditable={false}>
          <Label>{label}</Label>

          {status == 'idle' && !canAct && <Detail>Waiting for a prompt</Detail>}

          {status == 'running' && (
            <>
              <Detail>{job ? 'Writing…' : 'Being written by the assistant…'}</Detail>
              {job && canAct && (
                <ActionButton type="button" onClick={() => agent?.cancel(blockId!)}>
                  Stop
                </ActionButton>
              )}
            </>
          )}

          {status == 'review' && (
            <>
              <Detail>
                {mode == 'block' && node.attrs.prompt ? node.attrs.prompt : 'Ready for review'}
              </Detail>
              {canAct && (
                <>
                  <ActionButton type="button" onClick={() => agent?.retry(blockId!)}>
                    Retry
                  </ActionButton>
                  <ActionButton type="button" onClick={() => agent?.discard(blockId!)}>
                    Discard
                  </ActionButton>
                  <ActionButton type="button" $primary onClick={() => agent?.accept(blockId!)}>
                    Accept
                  </ActionButton>
                </>
              )}
            </>
          )}

          {status == 'error' && (
            <>
              <Detail $error>
                {job?.error ?? 'The assistant could not finish this block.'}
              </Detail>
              {canAct && (
                <ActionButton type="button" onClick={() => agent?.retry(blockId!)}>
                  Retry
                </ActionButton>
              )}
            </>
          )}

          {canAct && (
            <IconButton
              type="button"
              aria-label="Remove"
              title="Remove"
              onClick={() => agent?.remove(blockId!)}
            >
              <IconClose />
            </IconButton>
          )}
        </Header>
      )}

      <Content data-hidden={status == 'idle' && isEmpty ? 'true' : 'false'} />
    </Wrap>
  );
};
