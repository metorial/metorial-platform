import { useEditorOverlay, useOverlayPosition, preserveEditorSelection } from './overlays';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { Theme } from '../styles/theme';
import { menuEnter, menuExit } from './animations';
import type { SlashItem } from './SlashMenu';
import { usePresence } from './usePresence';

let ENTER = 160;
let EXIT = 140;

let Wrap = styled.div<{ $width: number; $maxHeight: number }>`
  position: fixed;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
  z-index: 1000;
  width: ${({ $width }) => $width}px;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
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

let Search = styled.input`
  margin: 6px;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 6px;
  background: ${({ theme }) => theme.color.bgAlt};
  color: ${({ theme }) => theme.color.text};
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.color.accent};
  }

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let Scroll = styled.div`
  padding: 4px 6px 6px;
  overflow-y: auto;
  flex: 1;
`;

let GroupLabel = styled.div`
  padding: 8px 6px 4px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.textSubtle};

  &:first-child {
    padding-top: 4px;
  }
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 0 2px 4px;
`;

let tintColor = (theme: Theme, tone?: 'info' | 'warning' | 'success' | 'danger') => {
  if (tone === 'info') return theme.color.callout.info.text;
  if (tone === 'warning') return theme.color.callout.warning.text;
  if (tone === 'success') return theme.color.callout.success.text;
  if (tone === 'danger') return theme.color.callout.danger.text;
  return theme.color.text;
};

let GridBtn = styled.button<{ $tone?: 'info' | 'warning' | 'success' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
  color: ${({ $tone, theme }) => tintColor(theme, $tone)};
  border-radius: 8px;
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgAlt};
    border-color: ${({ theme }) => theme.color.borderStrong};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let RowBtn = styled.button<{ $selected?: boolean; $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px;
  border: 0;
  background: ${({ $selected, theme }) => ($selected ? theme.color.bgAlt : 'transparent')};
  color: ${({ theme }) => theme.color.text};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  font-family: inherit;
  font-size: 14px;
`;

let RowIconBox = styled.span<{
  $tone?: 'info' | 'warning' | 'success' | 'danger';
}>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
  color: ${({ $tone, theme }) => tintColor(theme, $tone)};
  border-radius: 6px;

  svg {
    width: 15px;
    height: 15px;
  }
`;

let RowTitle = styled.span`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let Empty = styled.div`
  padding: 14px;
  color: ${({ theme }) => theme.color.textSubtle};
  font-size: 13px;
  text-align: center;
`;

interface Props {
  /** Whether the popover is open. When toggled to `false`, the popover
   *  stays mounted long enough to play its exit animation. */
  triggerRef?: { current: HTMLElement | null };
  open: boolean;
  /** top-left corner in viewport coordinates where the popover should anchor */
  anchor: { left: number; top: number };
  items: SlashItem[];
  /** id of the currently active item (matched against title) so it shows highlighted */
  activeTitle?: string;
  showSearch?: boolean;
  showRecommended?: boolean;
  searchPlaceholder?: string;
  width?: number;
  maxHeight?: number;

  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}

export function BlocksPopover({
  triggerRef,
  open,
  anchor,
  items,
  activeTitle,
  showSearch = false,
  showRecommended = false,
  searchPlaceholder = 'Search…',
  width = 280,
  maxHeight = 380,

  onSelect,
  onClose
}: Props) {
  let presence = usePresence(open, EXIT);
  let wrapRef = useRef<HTMLDivElement | null>(null);
  let [search, setSearch] = useState('');
  let [activeIndex, setActiveIndex] = useState(0);

  let filtered = useMemo(() => {
    let q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      [item.title, item.description, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [search, items]);

  let safeIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1));

  // Reset internal state when the popover (re-)opens.
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(0);
    }
  }, [open]);

  useEditorOverlay(open, {
    element: () => wrapRef.current,
    trigger: () => triggerRef?.current ?? null,
    close: onClose,
    restoreFocus: () => triggerRef?.current?.focus()
  });

  let position = useOverlayPosition(
    presence.shouldRender,
    wrapRef,
    () => {
      if (triggerRef && !triggerRef.current?.isConnected) return null;
      if (triggerRef?.current) {
        let rect = triggerRef.current.getBoundingClientRect();
        if (!rect.width && !rect.height) return null;
        return { left: rect.left, top: rect.bottom + 4 };
      }
      return anchor;
    },
    onClose,
    'left'
  );

  useEffect(() => {
    wrapRef.current
      ?.querySelector(`[data-block-index="${safeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [safeIndex]);

  if (!presence.shouldRender) return null;

  let handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || !filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(Math.min(filtered.length - 1, safeIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(Math.max(0, safeIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      let item = filtered[safeIndex];
      if (item) onSelect(item);
    }
  };

  let groups: Record<string, SlashItem[]> = {};
  filtered.forEach(item => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });

  let isFiltered = filtered.length !== items.length;
  let recommended = showRecommended && !isFiltered ? items.filter(i => i.recommended) : [];

  let runningIndex = 0;

  return createPortal(
    <Wrap
      role="menu"
      aria-label="Blocks"
      ref={wrapRef}
      data-state={presence.dataState}
      style={{ left: position.left, top: position.top }}
      $width={width}
      $maxHeight={maxHeight}
      onMouseDown={preserveEditorSelection}
    >
      {showSearch && (
        <Search
          autoFocus
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
      )}
      <Scroll>
        {recommended.length > 0 && (
          <>
            <GroupLabel>Recommended</GroupLabel>
            <Grid>
              {recommended.map(item => (
                <GridBtn
                  type="button"
                  key={`grid-${item.title}`}
                  $tone={item.iconTone}
                  title={item.title}
                  onClick={() => onSelect(item)}
                >
                  {item.icon}
                </GridBtn>
              ))}
            </Grid>
          </>
        )}
        {filtered.length === 0 && <Empty>No matches</Empty>}
        {Object.entries(groups).map(([group, entries]) => (
          <div key={group}>
            <GroupLabel>{group}</GroupLabel>
            {entries.map(item => {
              let myIndex = runningIndex++;
              return (
                <RowBtn
                  key={item.title}
                  role="menuitem"
                  data-block-index={myIndex}
                  type="button"
                  $selected={myIndex === safeIndex}
                  $active={item.title === activeTitle}
                  onMouseEnter={() => setActiveIndex(myIndex)}
                  onClick={() => onSelect(item)}
                  title={item.description}
                >
                  <RowIconBox $tone={item.iconTone}>{item.icon}</RowIconBox>
                  <RowTitle>{item.title}</RowTitle>
                </RowBtn>
              );
            })}
          </div>
        ))}
      </Scroll>
    </Wrap>,
    document.body
  );
}
