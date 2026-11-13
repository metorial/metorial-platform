import type { Editor } from '@tiptap/react';
import { useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { IconArrowRight, IconClose, IconSparkle } from '../icons';
import { getDocsAgentApi } from './api';

let Panel = styled.div`
  display: flex;
  flex-direction: column;
  width: 340px;
`;

let InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 2px 8px;
  color: ${({ theme }) => theme.color.accent};

  svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
`;

let Input = styled.input`
  flex: 1;
  min-width: 0;
  height: 28px;
  border: 0;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 13px;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
  }

  &:disabled {
    color: ${({ theme }) => theme.color.textSubtle};
    cursor: not-allowed;
  }
`;

let Actions = styled.div`
  display: flex;
  flex-direction: column;
  padding: 4px;
  border-top: 1px solid ${({ theme }) => theme.color.border};
`;

let Action = styled.button`
  padding: 6px 8px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }
`;

let rewriteActions = [
  { label: 'Improve writing', instruction: 'Improve the writing. Keep the meaning.' },
  { label: 'Make shorter', instruction: 'Make this shorter and more concise.' },
  { label: 'Make longer', instruction: 'Expand this with more detail.' },
  { label: 'Fix spelling & grammar', instruction: 'Fix spelling and grammar only.' },
  { label: 'Make more formal', instruction: 'Rewrite this in a more formal tone.' },
  { label: 'Make more casual', instruction: 'Rewrite this in a more casual tone.' }
];

export let AskAiPanel = (p: { editor: Editor; onClose: () => void }) => {
  let [instruction, setInstruction] = useState('');
  let inputRef = useRef<HTMLInputElement | null>(null);
  let api = getDocsAgentApi(p.editor);

  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  let rewrite = (text: string) => {
    if (!text.trim()) return;
    api?.rewriteSelection(text.trim());
    p.onClose();
  };

  return (
    <Panel data-keep-open="true">
      <InputRow>
        <IconSparkle />
        <Input
          ref={inputRef}
          value={instruction}
          placeholder="Ask AI to edit the selection…"
          onChange={event => setInstruction(event.target.value)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key == 'Enter') {
              event.preventDefault();
              rewrite(instruction);
            } else if (event.key == 'Escape') {
              event.preventDefault();
              p.onClose();
            }
          }}
        />
        <IconButton
          type="button"
          title="Rewrite (Enter)"
          disabled={!instruction.trim()}
          onClick={() => rewrite(instruction)}
        >
          <IconArrowRight />
        </IconButton>
        <IconButton type="button" title="Cancel (Esc)" onClick={p.onClose}>
          <IconClose />
        </IconButton>
      </InputRow>

      <Actions>
        {rewriteActions.map(action => (
          <Action key={action.label} type="button" onClick={() => rewrite(action.instruction)}>
            {action.label}
          </Action>
        ))}
        <Action
          type="button"
          onClick={() => {
            api?.summarizeSelection();
            p.onClose();
          }}
        >
          Summarize below
        </Action>
      </Actions>
    </Panel>
  );
};
