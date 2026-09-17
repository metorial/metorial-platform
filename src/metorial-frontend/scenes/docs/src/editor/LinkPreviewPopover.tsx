import type { Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { hasEditorOverlay, registerEditorOverlay, useOverlayPosition } from './overlays';
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

interface Props {
  editor: TiptapEditor | null;
  suppress?: boolean;
}

export function LinkPreviewPopover({ editor, suppress = false }: Props) {
  let [active, setActive] = useState<HTMLAnchorElement | null>(null);
  let wrapRef = useRef<HTMLDivElement | null>(null);
  let cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!editor || suppress) {
      setActive(null);
      return;
    }
    let dom = editor.view.dom;
    let candidate: HTMLAnchorElement | null = null;
    let dismissed: HTMLAnchorElement | null = null;
    let visible: HTMLAnchorElement | null = null;
    let overLink = false;
    let candidateHref = '';
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let unregister: (() => void) | null = null;
    let clearOpen = () => {
      if (openTimer) clearTimeout(openTimer);
      openTimer = null;
    };
    let clearClose = () => {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = null;
    };
    let cancel = () => {
      clearOpen();
      clearClose();
      dismissed = candidate;
      candidate = null;
      visible = null;
      setActive(null);
      unregister?.();
      unregister = null;
    };
    cancelRef.current = cancel;
    let insidePreview = () =>
      !!wrapRef.current &&
      (wrapRef.current.matches(':hover') || wrapRef.current.contains(document.activeElement));
    let scheduleClose = () => {
      clearOpen();
      if (closeTimer || insidePreview()) return;
      closeTimer = setTimeout(() => {
        closeTimer = null;
        if (!overLink && !insidePreview()) cancel();
      }, 250);
    };
    let onMove = (event: PointerEvent) => {
      let target = event.target instanceof Element ? event.target : null;
      if (wrapRef.current?.contains(target)) {
        clearClose();
        return;
      }
      let link = target?.closest<HTMLAnchorElement>('a[href]') ?? null;
      if (link && !dom.contains(link)) link = null;
      overLink = !!link;
      if (!link) {
        dismissed = null;
        scheduleClose();
        return;
      }
      if (link === dismissed || hasEditorOverlay()) return;
      clearClose();
      if (link === candidate) {
        if (visible || openTimer) return;
      } else {
        cancel();
        dismissed = null;
        candidate = link;
        candidateHref = link.href;
      }
      if (!validateLinkUrl(link.href).ok) return;
      if (!unregister)
        unregister = registerEditorOverlay({
          element: () => wrapRef.current,
          trigger: () => candidate,
          automatic: true,
          close: cancel
        });
      openTimer = setTimeout(() => {
        openTimer = null;
        if (candidate?.isConnected && overLink && !hasEditorOverlay()) {
          visible = candidate;
          setActive(candidate);
        }
      }, 800);
    };
    let onOut = (event: PointerEvent) => {
      let next = event.relatedTarget as Node | null;
      if (candidate?.contains(next)) return;
      overLink = false;
      dismissed = null;
      if (wrapRef.current?.contains(next)) {
        clearClose();
        return;
      }
      scheduleClose();
    };
    let onFocusOut = () => {
      if (!overLink) scheduleClose();
    };
    let onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' && !wrapRef.current?.contains(event.target as Node)) cancel();
    };
    let onTransaction = () => {
      if (
        candidate &&
        (!candidate.isConnected ||
          candidate.href !== candidateHref ||
          !validateLinkUrl(candidate.href).ok)
      )
        cancel();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusout', onFocusOut);
    dom.addEventListener('keydown', onKey);
    editor.on('transaction', onTransaction);
    return () => {
      cancel();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusout', onFocusOut);
      dom.removeEventListener('keydown', onKey);
      editor.off('transaction', onTransaction);
    };
  }, [editor, suppress]);

  let position = useOverlayPosition(
    !!active,
    wrapRef,
    () => {
      if (!active?.isConnected) return null;
      let rect = active.getBoundingClientRect();
      if (!rect.width && !rect.height) return null;
      let height = wrapRef.current?.getBoundingClientRect().height ?? 36;
      let width = wrapRef.current?.getBoundingClientRect().width ?? 240;
      return {
        left: rect.left + (rect.width - width) / 2,
        top: rect.top >= height + 16 ? rect.top - height - 8 : rect.bottom + 8
      };
    },
    () => cancelRef.current()
  );

  if (!active || suppress) return null;
  return createPortal(
    <Wrap ref={wrapRef} style={position} aria-label="Link preview">
      <UrlText title={active.href}>{active.href}</UrlText>
      <OpenBtn
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          let result = validateLinkUrl(active.href);
          if (result.ok) window.open(result.url, '_blank', 'noopener,noreferrer');
        }}
      >
        <IconExternalLink />
        Open
      </OpenBtn>
    </Wrap>,
    document.body
  );
}
