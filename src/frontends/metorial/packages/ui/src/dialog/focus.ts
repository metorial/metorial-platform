import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

let textFieldSelector = 'input, textarea';
let textInputTypes = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

let isEligibleField = (
  field: HTMLInputElement | HTMLTextAreaElement,
  content: HTMLElement
) => {
  if (
    field.closest('[role="dialog"]') !== content ||
    field.matches(':disabled') ||
    field.readOnly ||
    field.tabIndex < 0 ||
    (field instanceof HTMLInputElement && !textInputTypes.has(field.type))
  ) {
    return false;
  }

  let view = field.ownerDocument.defaultView;

  for (let ancestor: HTMLElement | null = field; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.matches('[hidden], [inert], [aria-hidden="true"]')) return false;

    let style = view?.getComputedStyle(ancestor);
    if (style?.display === 'none') return false;
  }

  let style = view?.getComputedStyle(field);
  return style?.visibility !== 'hidden' && style?.visibility !== 'collapse';
};

let focusFirstField = (content: HTMLElement) => {
  for (let field of content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    textFieldSelector
  )) {
    if (!isEligibleField(field, content)) continue;

    field.focus({ preventScroll: true });
    if (content.ownerDocument.activeElement === field) return true;
  }

  return false;
};

export let useModalAutoFocus = (
  contentRef: RefObject<HTMLDivElement | null>,
  isOpen: boolean
) => {
  let [content, setContent] = useState<HTMLDivElement | null>(null);
  let session = useRef({ handledOpen: false, completed: false });

  let ref = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      setContent(node);
    },
    [contentRef]
  );

  let onOpenAutoFocus = useCallback(
    (event: Event) => {
      let node = contentRef.current;
      session.current = { handledOpen: true, completed: false };
      if (!node) return;

      if (node.contains(node.ownerDocument.activeElement) || focusFirstField(node)) {
        session.current.completed = true;
        event.preventDefault();
      }
    },
    [contentRef]
  );

  useEffect(() => {
    if (!isOpen || !content || session.current.completed) return;

    let doc = content.ownerDocument;
    let cancelled = false;
    let observer: MutationObserver | undefined;
    let fallback: Element | null = null;

    let stop = () => {
      session.current.completed = true;
      observer?.disconnect();
      doc.removeEventListener('pointerdown', stop, true);
      doc.removeEventListener('keydown', stop, true);
      doc.removeEventListener('focusin', onFocus, true);
    };

    let onFocus = () => {
      if (doc.activeElement !== fallback) stop();
    };

    let tryFocus = () => {
      if (session.current.completed) return;
      if (doc.activeElement !== fallback || !content.contains(fallback)) {
        stop();
        return;
      }

      if (focusFirstField(content)) stop();
    };

    // Radix applies its fallback after the open autofocus event returns.
    queueMicrotask(() => {
      if (cancelled || session.current.completed) return;

      if (!session.current.handledOpen) {
        stop();
        return;
      }

      fallback = doc.activeElement;
      observer = new MutationObserver(tryFocus);
      observer.observe(content, { childList: true, subtree: true, attributes: true });
      doc.addEventListener('pointerdown', stop, true);
      doc.addEventListener('keydown', stop, true);
      doc.addEventListener('focusin', onFocus, true);
      tryFocus();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      doc.removeEventListener('pointerdown', stop, true);
      doc.removeEventListener('keydown', stop, true);
      doc.removeEventListener('focusin', onFocus, true);
    };
  }, [content, isOpen]);

  return { ref, onOpenAutoFocus };
};
