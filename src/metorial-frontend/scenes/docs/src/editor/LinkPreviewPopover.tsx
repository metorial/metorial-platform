import { getMarkRange } from '@tiptap/core';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { menuEnter } from './animations';
import { IconExternalLink } from './icons';
import { validateLinkUrl } from './url';

let Wrap = styled.div`
  position: fixed;
  z-index: 1001;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(420px, calc(100vw - 16px));
  padding: 6px 8px 6px 10px;
  background: ${({ theme }) => theme.color.bgElevated};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  ${menuEnter(140)}
`;

let UrlText = styled.span`
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.color.textMuted};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let OpenBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: ${({ theme }) => theme.color.bgAlt};
  color: ${({ theme }) => theme.color.text};
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};
  flex-shrink: 0;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }

  svg {
    width: 12px;
    height: 12px;
  }
`;

interface AnchorData {
  href: string;
  left: number;
  top: number;
}

interface Props {
  editor: TiptapEditor | null;
  suppress?: boolean;
}

function normalizeHref(raw: string): string {
  if (!raw.trim()) return '';
  try {
    return new URL(raw, window.location.href).toString();
  } catch {
    return raw;
  }
}

function isSameAnchor(a: AnchorData | null, b: AnchorData | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.href === b.href &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.top) === Math.round(b.top)
  );
}

function isSamePosition(
  a: { left: number; top: number } | null,
  b: { left: number; top: number } | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.round(a.left) === Math.round(b.left) && Math.round(a.top) === Math.round(b.top);
}

export function LinkPreviewPopover({ editor, suppress = false }: Props) {
  let [hovered, setHovered] = useState<AnchorData | null>(null);
  let [caret, setCaret] = useState<AnchorData | null>(null);
  let [isOverPopover, setIsOverPopover] = useState(false);
  let [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  let wrapRef = useRef<HTMLDivElement | null>(null);
  let hideHoverTimerRef = useRef<number | null>(null);

  let clearHideHoverTimer = useCallback(() => {
    if (hideHoverTimerRef.current == null) return;
    window.clearTimeout(hideHoverTimerRef.current);
    hideHoverTimerRef.current = null;
  }, []);

  let setHoveredAnchor = useCallback((next: AnchorData | null) => {
    setHovered(prev => (isSameAnchor(prev, next) ? prev : next));
  }, []);

  let setCaretAnchor = useCallback((next: AnchorData | null) => {
    setCaret(prev => (isSameAnchor(prev, next) ? prev : next));
  }, []);

  let scheduleHideHover = useCallback(() => {
    clearHideHoverTimer();
    hideHoverTimerRef.current = window.setTimeout(() => {
      setHovered(prev => (prev ? null : prev));
      hideHoverTimerRef.current = null;
    }, 220);
  }, [clearHideHoverTimer]);

  useEffect(() => {
    if (!editor) return;
    let dom = editor.view.dom;
    let onMouseMove = (event: MouseEvent) => {
      if (suppress) {
        clearHideHoverTimer();
        setHoveredAnchor(null);
        return;
      }
      let target = event.target as Element | null;
      let link = target?.closest('a[href]');
      if (!link || !dom.contains(link)) {
        if (isOverPopover) return;
        scheduleHideHover();
        return;
      }
      clearHideHoverTimer();
      let element = link as HTMLAnchorElement;
      let href = normalizeHref(element.getAttribute('href') ?? element.href ?? '');
      if (!href) {
        setHoveredAnchor(null);
        return;
      }
      let rect = element.getBoundingClientRect();
      if (
        !Number.isFinite(rect.left) ||
        !Number.isFinite(rect.top) ||
        (rect.width === 0 && rect.height === 0)
      ) {
        setHoveredAnchor(null);
        return;
      }
      setHoveredAnchor({
        href,
        left: rect.left + rect.width / 2,
        top: rect.top
      });
    };
    let onMouseLeave = () => {
      if (isOverPopover) return;
      scheduleHideHover();
    };
    dom.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('mouseleave', onMouseLeave);
    return () => {
      dom.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mouseleave', onMouseLeave);
      clearHideHoverTimer();
    };
  }, [editor, suppress, isOverPopover, clearHideHoverTimer, scheduleHideHover]);

  let updateCaretAnchor = useCallback(() => {
    if (!editor || suppress) {
      setCaretAnchor(null);
      return;
    }
    let { selection, schema } = editor.state;
    if (!selection.empty) {
      setCaretAnchor(null);
      return;
    }
    let linkMark = schema.marks.link;
    if (!linkMark) {
      setCaretAnchor(null);
      return;
    }
    let range = getMarkRange(selection.$from, linkMark);
    if (!range) {
      setCaretAnchor(null);
      return;
    }
    let href = normalizeHref((editor.getAttributes('link').href as string) ?? '');
    if (!href) {
      setCaretAnchor(null);
      return;
    }
    try {
      let start = editor.view.coordsAtPos(range.from);
      let end = editor.view.coordsAtPos(Math.max(range.to - 1, range.from));
      setCaretAnchor({
        href,
        left: (start.left + end.right) / 2,
        top: Math.min(start.top, end.top)
      });
    } catch {
      setCaretAnchor(null);
    }
  }, [editor, suppress, setCaretAnchor]);

  useEffect(() => {
    if (!editor) return;
    updateCaretAnchor();
    let onSelectionOrDocChange = () => updateCaretAnchor();
    let onBlur = () => setCaretAnchor(null);
    editor.on('selectionUpdate', onSelectionOrDocChange);
    editor.on('transaction', onSelectionOrDocChange);
    editor.on('focus', onSelectionOrDocChange);
    editor.on('blur', onBlur);
    return () => {
      editor.off('selectionUpdate', onSelectionOrDocChange);
      editor.off('transaction', onSelectionOrDocChange);
      editor.off('focus', onSelectionOrDocChange);
      editor.off('blur', onBlur);
    };
  }, [editor, setCaretAnchor, updateCaretAnchor]);

  useEffect(() => {
    if (!suppress) return;
    clearHideHoverTimer();
    setHoveredAnchor(null);
    setCaretAnchor(null);
  }, [suppress, setCaretAnchor, setHoveredAnchor, clearHideHoverTimer]);

  let active = useMemo(() => {
    if (suppress) return null;
    return hovered ?? caret;
  }, [caret, hovered, suppress]);

  useEffect(() => {
    if (!active) {
      setPosition(null);
      return;
    }
    setPosition(prev => {
      let next = { left: active.left, top: active.top };
      return isSamePosition(prev, next) ? prev : next;
    });
  }, [active]);

  useLayoutEffect(() => {
    if (!active) return;
    let el = wrapRef.current;
    if (!el) return;
    let rect = el.getBoundingClientRect();
    let padding = 8;
    let left = active.left - rect.width / 2;
    let top = active.top - rect.height - 8;
    if (left < padding) left = padding;
    if (left + rect.width + padding > window.innerWidth) {
      left = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (top < padding) top = padding;
    let next = { left, top };
    setPosition(prev => (isSamePosition(prev, next) ? prev : next));
  }, [active, position?.left, position?.top]);

  let handleOpen = useCallback(() => {
    if (!active) return;
    let result = validateLinkUrl(active.href);
    if (!result.ok) return;
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }, [active]);

  if (!active || !position) return null;

  return createPortal(
    <Wrap
      ref={wrapRef}
      style={{ left: position.left, top: position.top }}
      onMouseEnter={() => {
        clearHideHoverTimer();
        setIsOverPopover(true);
      }}
      onMouseLeave={() => {
        setIsOverPopover(false);
        if (!caret) scheduleHideHover();
      }}
    >
      <UrlText title={active.href}>{active.href}</UrlText>
      <OpenBtn type="button" onMouseDown={e => e.preventDefault()} onClick={handleOpen}>
        <IconExternalLink />
        Open
      </OpenBtn>
    </Wrap>,
    document.body
  );
}
