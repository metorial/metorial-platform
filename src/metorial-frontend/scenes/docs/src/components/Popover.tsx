import { useZindex } from '@metorial/ui';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { menuEnter, menuExit } from '../editor/animations';
import { usePresence } from '../editor/usePresence';

let ENTER = 160;
let EXIT = 140;

interface WrapProps {
  $width?: number | string;
  $alignRight?: boolean;
}

let Wrap = styled.div<WrapProps>`
  position: fixed;
  ${({ $width }) =>
    $width != null ? `width: ${typeof $width === 'number' ? `${$width}px` : $width};` : ''}
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.color.bg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.color.shadow};
  font-family: ${({ theme }) => theme.font.sans};
  color: ${({ theme }) => theme.color.text};
  transform-origin: ${({ $alignRight }) => ($alignRight ? 'top right' : 'top left')};

  &[data-state='open'] {
    ${menuEnter(ENTER)}
  }

  &[data-state='closed'] {
    ${menuExit(EXIT)}
    pointer-events: none;
  }
`;

interface PopoverProps {
  open: boolean;
  /** Anchor point in viewport coordinates. Treated as the top edge; the
   *  horizontal edge is controlled by `align`. */
  anchor: { left: number; top: number };
  /** When 'right', the popover's right edge aligns to anchor.left.
   *  Otherwise the left edge aligns. Defaults to 'left'. */
  align?: 'left' | 'right';
  width?: number | string;
  /** Selector for elements that should be ignored by the outside-click
   *  handler (typically the trigger button itself). */
  ignoreClickOnSelector?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Popover({
  open,
  anchor,
  align = 'left',
  width,
  ignoreClickOnSelector,
  onClose,
  children
}: PopoverProps) {
  let presence = usePresence(open, EXIT);
  let wrapRef = useRef<HTMLDivElement | null>(null);
  let [position, setPosition] = useState({ left: anchor.left, top: anchor.top });
  let zIndex = useZindex(open);

  useEffect(() => {
    if (!open) return;
    let onMouse = (e: MouseEvent) => {
      let target = e.target as Element | null;
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(target as Node)) return;
      if (target?.closest('[data-metorial-select-content]')) return;
      if (ignoreClickOnSelector && target?.closest(ignoreClickOnSelector)) return;
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
  }, [open, onClose, ignoreClickOnSelector]);

  useLayoutEffect(() => {
    if (!presence.shouldRender) return;
    let padding = 8;
    let el = wrapRef.current;
    let left = anchor.left;
    let top = anchor.top;
    if (el) {
      let rect = el.getBoundingClientRect();
      if (align === 'right') {
        left = anchor.left - rect.width;
      }
      if (left + rect.width + padding > window.innerWidth) {
        left = Math.max(padding, window.innerWidth - rect.width - padding);
      }
      if (left < padding) left = padding;
      if (top + rect.height + padding > window.innerHeight) {
        top = Math.max(padding, window.innerHeight - rect.height - padding);
      }
      if (top < padding) top = padding;
    }
    setPosition({ left, top });
  }, [presence.shouldRender, anchor.left, anchor.top, align]);

  if (!presence.shouldRender) return null;

  return createPortal(
    <Wrap
      ref={wrapRef}
      data-state={presence.dataState}
      style={{ left: position.left, top: position.top, zIndex }}
      $width={width}
      $alignRight={align === 'right'}
    >
      {children}
    </Wrap>,
    document.body
  );
}

/** Hook to manage anchor coordinates for a trigger button + popover pair. */
export function usePopoverAnchor(align: 'left' | 'right' = 'left') {
  let triggerRef = useRef<HTMLButtonElement | null>(null);
  let [open, setOpen] = useState(false);
  let [anchor, setAnchor] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0
  });

  let computeAnchor = () => {
    let el = triggerRef.current;
    if (!el) return null;
    let rect = el.getBoundingClientRect();
    return {
      left: align === 'right' ? rect.right : rect.left,
      top: rect.bottom + 4
    };
  };

  let openMenu = () => {
    let a = computeAnchor();
    if (a) setAnchor(a);
    setOpen(true);
  };

  let closeMenu = () => setOpen(false);

  let toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      let a = computeAnchor();
      if (a) setAnchor(a);
      setOpen(true);
    }
  };

  return { triggerRef, open, anchor, openMenu, closeMenu, toggle };
}
