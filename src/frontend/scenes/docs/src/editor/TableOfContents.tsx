import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import styled from 'styled-components';

interface TocItem {
  key: string;
  id: string;
  text: string;
  level: number;
  pos: number;
}

function slugifyHeading(text: string): string {
  let normalized = text
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'heading';
}

interface TableOfContentsProps {
  editor: Editor;
  scrollContainerRef: RefObject<HTMLElement | null>;
  documentTitle: string;
  allowInitialHashScroll?: boolean;
  onInitialHashScrollComplete?: () => void;
}

let Wrap = styled.aside<{ $expanded: boolean; $visible: boolean }>`
  position: fixed;
  top: 182px;
  right: 30px;
  z-index: 30;
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  width: ${({ $expanded }) => ($expanded ? 320 : 42)}px;
  max-height: calc(100vh - 110px);
  overflow: hidden;
  border-radius: 16px;
  border: ${({ $expanded, theme }) => ($expanded ? `1px solid ${theme.color.border}` : '0')};
  background: ${({ $expanded, theme }) => ($expanded ? theme.color.bg : 'transparent')};
  box-shadow: ${({ $expanded, theme }) => ($expanded ? theme.shadow.sm : 'none')};
  transition:
    width 180ms ease,
    border ${({ theme }) => theme.motion.fast},
    background ${({ theme }) => theme.motion.fast},
    box-shadow ${({ theme }) => theme.motion.fast};

  &:hover {
    box-shadow: ${({ $expanded, theme }) => ($expanded ? theme.shadow.md : 'none')};
  }

  @media (max-width: 1200px) {
    display: none;
  }
`;

let Rail = styled.div<{ $expanded: boolean }>`
  display: ${({ $expanded }) => ($expanded ? 'none' : 'flex')};
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 14px 8px;
`;

let RailLine = styled.span<{ $width: number; $active: boolean }>`
  display: block;
  width: ${({ $width }) => $width}px;
  height: 2px;
  border-radius: 999px;
  background: ${({ $active, theme }) =>
    $active ? theme.color.textMuted : theme.color.border};
  opacity: ${({ $active }) => ($active ? 0.95 : 0.75)};
  transition:
    background ${({ theme }) => theme.motion.fast},
    opacity ${({ theme }) => theme.motion.fast};
`;

let Expanded = styled.div<{ $expanded: boolean }>`
  display: ${({ $expanded }) => ($expanded ? 'flex' : 'none')};
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  max-height: calc(100vh - 110px);
  overflow-y: auto;
  overflow-x: hidden;
`;

let DocTitle = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.textSubtle};
  padding: 0 8px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let TocBtn = styled.button<{ $active: boolean; $indent: number }>`
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 8px;
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.color.text : theme.color.textMuted)};
  font: inherit;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  padding: ${({ $indent }) => `3px 8px 3px ${8 + $indent}px`};
  opacity: ${({ $active }) => ($active ? 1 : 0.85)};
  transition:
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast},
    opacity ${({ theme }) => theme.motion.fast};
  min-width: 0;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
    opacity: 1;
  }

  .label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

function getHeadingItems(editor: Editor): TocItem[] {
  let items: TocItem[] = [];
  let used = new Set<string>();
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;
    let text = node.textContent.trim() || 'Untitled heading';
    let level = (node.attrs.level as number) ?? 1;
    let existingId = (node.attrs.id as string | null) ?? '';
    let id = existingId.trim();
    if (!id) {
      let base = slugifyHeading(text);
      id = base;
      let suffix = 2;
      while (used.has(id)) {
        id = `${base}-${suffix++}`;
      }
    }
    let key = `${id}:${pos}`;
    used.add(id);
    items.push({ key, id, text, level, pos });
    return true;
  });
  return items;
}

function lineWidthForLevel(level: number): number {
  if (level <= 1) return 18;
  if (level === 2) return 15;
  if (level === 3) return 13;
  if (level === 4) return 11;
  if (level === 5) return 9;
  return 7;
}

export function TableOfContents({
  editor,
  scrollContainerRef,
  documentTitle,
  allowInitialHashScroll = false,
  onInitialHashScrollComplete
}: TableOfContentsProps) {
  let [expanded, setExpanded] = useState(false);
  let [items, setItems] = useState<TocItem[]>(() => getHeadingItems(editor));
  let [activeId, setActiveId] = useState<string | null>(null);
  let lastHandledHashRef = useRef<string | null>(null);

  let refreshHeadings = useCallback(() => {
    setItems(getHeadingItems(editor));
  }, [editor]);

  let updateActiveHeading = useCallback(() => {
    let scrollContainer = scrollContainerRef.current;
    if (!items.length || !scrollContainer) {
      setActiveId(items[0]?.id ?? null);
      return;
    }
    let containerRect = scrollContainer.getBoundingClientRect();
    let threshold = containerRect.top + 110;
    let winner: string | null = items[0]?.id ?? null;

    for (let item of items) {
      let dom = editor.view.nodeDOM(item.pos);
      if (!(dom instanceof HTMLElement)) continue;
      let top = dom.getBoundingClientRect().top;
      if (top <= threshold) winner = item.id;
      else break;
    }
    setActiveId(winner);
  }, [editor, items, scrollContainerRef]);

  let scrollToHeading = useCallback(
    (item: TocItem) => {
      let scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      let dom = editor.view.nodeDOM(item.pos);
      if (!(dom instanceof HTMLElement)) return;
      let containerRect = scrollContainer.getBoundingClientRect();
      let targetTop =
        dom.getBoundingClientRect().top - containerRect.top + scrollContainer.scrollTop - 90;
      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
      lastHandledHashRef.current = item.id;
      window.history.replaceState(null, '', `#${item.id}`);
    },
    [editor, scrollContainerRef]
  );

  useEffect(() => {
    editor.on('update', refreshHeadings);
    return () => {
      editor.off('update', refreshHeadings);
    };
  }, [editor, refreshHeadings]);

  useEffect(() => {
    updateActiveHeading();
  }, [items, updateActiveHeading]);

  useEffect(() => {
    let scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    let onScroll = () => updateActiveHeading();
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [scrollContainerRef, updateActiveHeading]);

  useEffect(() => {
    if (!allowInitialHashScroll) return;
    let scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    let raw = window.location.hash.replace(/^#/, '').trim();
    if (!raw) {
      onInitialHashScrollComplete?.();
      return;
    }
    let id = decodeURIComponent(raw);
    if (lastHandledHashRef.current === id) {
      onInitialHashScrollComplete?.();
      return;
    }
    let item = items.find(entry => entry.id === id);
    if (!item) return;
    lastHandledHashRef.current = id;
    requestAnimationFrame(() => {
      scrollToHeading(item);
      onInitialHashScrollComplete?.();
    });
  }, [
    allowInitialHashScroll,
    items,
    onInitialHashScrollComplete,
    scrollContainerRef,
    scrollToHeading
  ]);

  let minLevel = useMemo(
    () => items.reduce((acc, item) => Math.min(acc, item.level), 6),
    [items]
  );

  let hasItems = items.length > 0;

  return (
    <Wrap
      $expanded={expanded && hasItems}
      $visible={hasItems}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Table of contents"
      aria-hidden={!hasItems}
    >
      <Rail $expanded={expanded}>
        {items.map(item => (
          <RailLine
            key={item.key}
            $width={lineWidthForLevel(item.level)}
            $active={item.id === activeId}
          />
        ))}
      </Rail>

      <Expanded $expanded={expanded}>
        <DocTitle title={documentTitle || 'Untitled'}>{documentTitle || 'Untitled'}</DocTitle>
        {items.map(item => (
          <TocBtn
            key={item.key}
            type="button"
            $active={item.id === activeId}
            $indent={Math.max(0, (item.level - minLevel) * 22)}
            title={item.text}
            onClick={() => scrollToHeading(item)}
          >
            <span className="label">{item.text}</span>
          </TocBtn>
        ))}
      </Expanded>
    </Wrap>
  );
}
