import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { Theme } from '../styles/theme';
import { menuEnter, menuExit } from './animations';
import { LanguagePicker } from './extensions/LanguagePicker';
import {
  IconLink,
  IconRowInsertAbove,
  IconRowInsertBelow,
  IconRowMoveDown,
  IconRowMoveUp,
  IconTrash
} from './icons';
import { slashItems, type SlashItem } from './SlashMenu';
import { usePresence } from './usePresence';

let ENTER = 160;
let EXIT = 140;

let Wrap = styled.div`
  position: fixed;
  z-index: 1000;
  width: 260px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.color.bg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.color.shadow};
  overflow: hidden;
  font-family: ${({ theme }) => theme.font.sans};
  transform-origin: top left;

  &[data-state='open'] {
    ${menuEnter(ENTER)}
  }

  &[data-state='closed'] {
    ${menuExit(EXIT)}
    pointer-events: none;
  }
`;

let Scroll = styled.div`
  padding: 8px;
  overflow-y: auto;
  flex: 1;
`;

let SectionTitle = styled.div`
  padding: 0 2px 6px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.accent};
`;

let LanguageRow = styled.div`
  padding: 0 2px 2px;

  .code-block-lang-btn {
    height: 32px;
    width: 100%;
    justify-content: space-between;
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: 8px;
    padding: 0 10px;
    font-size: 13px;
    color: ${({ theme }) => theme.color.text};
    background: ${({ theme }) => theme.color.bg};
  }
`;

let TurnGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
`;

let tintColor = (theme: Theme, tone?: 'info' | 'warning' | 'success' | 'danger') => {
  if (tone === 'info') return theme.color.callout.info.text;
  if (tone === 'warning') return theme.color.callout.warning.text;
  if (tone === 'success') return theme.color.callout.success.text;
  if (tone === 'danger') return theme.color.callout.danger.text;
  return theme.color.text;
};

let TurnBtn = styled.button<{
  $active?: boolean;
  $tone?: 'info' | 'warning' | 'success' | 'danger';
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 32px;
  padding: 0;
  border: 1px solid
    ${({ $active, theme }) => ($active ? theme.color.accent : theme.color.border)};
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : theme.color.bg)};
  color: ${({ $active, $tone, theme }) =>
    $active ? theme.color.accent : tintColor(theme, $tone)};
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color ${({ theme }) => theme.motion.fast},
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgAlt};
    border-color: ${({ theme }) => theme.color.borderStrong};
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

let Divider = styled.div`
  height: 1px;
  margin: 10px 2px 6px;
  background: ${({ theme }) => theme.color.border};
`;

let ActionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let ActionBtn = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: ${({ $danger, theme }) => ($danger ? theme.color.danger : theme.color.text)};
  text-align: left;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgAlt};
  }

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
`;

let turnIntoItems = slashItems.filter(i => i.convertible && i.icon);

interface Props {
  open: boolean;
  anchor: { left: number; top: number };
  isCodeBlock?: boolean;
  isImageBlock?: boolean;
  headingLink?: string;
  codeLanguage?: string;
  activeTitle?: string;
  onSelect: (item: SlashItem) => void;
  onCopyHeadingLink?: () => void;
  onCodeLanguageChange?: (lang: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BlockMenu({
  open,
  anchor,
  isCodeBlock = false,
  isImageBlock = false,
  headingLink,
  codeLanguage = 'plaintext',
  activeTitle,
  onSelect,
  onCopyHeadingLink,
  onCodeLanguageChange,
  onMoveUp,
  onMoveDown,
  onInsertAbove,
  onInsertBelow,
  onDelete,
  onClose
}: Props) {
  let presence = usePresence(open, EXIT);
  let wrapRef = useRef<HTMLDivElement | null>(null);
  let showTurnInto = !isCodeBlock && !isImageBlock;
  let showTopSection = isCodeBlock || showTurnInto;

  useEffect(() => {
    if (!open) return;
    let onMouse = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      let target = e.target as Element | null;
      if (wrapRef.current.contains(target as Node)) return;
      if (target?.closest('[data-block-handle="true"]')) return;
      if (target?.closest('.code-block-lang-popover')) return;
      onClose();
    };
    let onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!presence.shouldRender) return null;

  return createPortal(
    <Wrap
      ref={wrapRef}
      data-state={presence.dataState}
      style={{ left: anchor.left, top: anchor.top }}
    >
      <Scroll>
        {isCodeBlock ? (
          <>
            <SectionTitle>Language</SectionTitle>
            <LanguageRow>
              <LanguagePicker
                value={codeLanguage}
                onChange={lang => onCodeLanguageChange?.(lang)}
              />
            </LanguageRow>
          </>
        ) : showTurnInto ? (
          <>
            <SectionTitle>Turn into</SectionTitle>
            <TurnGrid>
              {turnIntoItems.map(item => (
                <TurnBtn
                  key={item.title}
                  type="button"
                  $active={item.title === activeTitle}
                  $tone={item.iconTone}
                  title={item.title}
                  onMouseDown={e => {
                    e.preventDefault();
                    onSelect(item);
                  }}
                >
                  {item.icon}
                </TurnBtn>
              ))}
            </TurnGrid>
          </>
        ) : null}

        {showTopSection && <Divider />}

        <ActionList>
          {headingLink && onCopyHeadingLink && (
            <ActionBtn
              type="button"
              title={headingLink}
              onMouseDown={e => {
                e.preventDefault();
                onCopyHeadingLink();
              }}
            >
              <IconLink />
              Copy link
            </ActionBtn>
          )}
          <ActionBtn
            type="button"
            title="Move block up"
            onMouseDown={e => {
              e.preventDefault();
              onMoveUp();
            }}
          >
            <IconRowMoveUp />
            Move up
          </ActionBtn>
          <ActionBtn
            type="button"
            title="Move block down"
            onMouseDown={e => {
              e.preventDefault();
              onMoveDown();
            }}
          >
            <IconRowMoveDown />
            Move down
          </ActionBtn>
          <ActionBtn
            type="button"
            title="Insert block above"
            onMouseDown={e => {
              e.preventDefault();
              onInsertAbove();
            }}
          >
            <IconRowInsertAbove />
            Insert above
          </ActionBtn>
          <ActionBtn
            type="button"
            title="Insert block below"
            onMouseDown={e => {
              e.preventDefault();
              onInsertBelow();
            }}
          >
            <IconRowInsertBelow />
            Insert below
          </ActionBtn>
          <ActionBtn
            type="button"
            $danger
            title="Delete block"
            onMouseDown={e => {
              e.preventDefault();
              onDelete();
            }}
          >
            <IconTrash />
            Delete
          </ActionBtn>
        </ActionList>
      </Scroll>
    </Wrap>,
    document.body
  );
}
