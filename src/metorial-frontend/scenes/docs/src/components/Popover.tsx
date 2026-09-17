import { useEditorOverlay, useOverlayPosition } from '../editor/overlays';
import { useZindex } from '@metorial/ui';
import { useRef, useState, type ReactNode } from 'react';
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
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow: auto;
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
  triggerRef?: { current: HTMLElement | null };
  open: boolean;
  /** Anchor point in viewport coordinates. Treated as the top edge; the
   *  horizontal edge is controlled by `align`. */
  anchor: { left: number; top: number };
  /** When 'right', the popover's right edge aligns to anchor.left.
   *  Otherwise the left edge aligns. Defaults to 'left'. */
  align?: 'left' | 'right';
  width?: number | string;

  onClose: () => void;
  children: ReactNode;
}

export function Popover({
  triggerRef,
  open,
  anchor,
  align = 'left',
  width,

  onClose,
  children
}: PopoverProps) {
  let presence = usePresence(open, EXIT);
  let wrapRef = useRef<HTMLDivElement | null>(null);

  let zIndex = useZindex(open);

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
        return { left: align === 'right' ? rect.right : rect.left, top: rect.bottom + 4 };
      }
      return anchor;
    },
    onClose,
    align
  );

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
