import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type CloseReason = 'escape' | 'outside' | 'replaced' | 'blur';
type Overlay = {
  element: () => HTMLElement | null;
  trigger?: () => HTMLElement | null;
  close: (reason: CloseReason) => void;
  automatic?: boolean;
  outside?: boolean;
  restoreFocus?: () => void;
  nativeEscape?: boolean;
};
let layers: Overlay[] = [];
let listening = false;
let lastIndex = (predicate: (layer: Overlay) => boolean) => {
  for (let i = layers.length - 1; i >= 0; i--) if (predicate(layers[i])) return i;
  return -1;
};
let contains = (layer: Overlay, target: Node | null) =>
  !!target && !!(layer.element()?.contains(target) || layer.trigger?.()?.contains(target));

export let hasEditorOverlay = () => layers.some(layer => !layer.automatic);

let remove = (layer: Overlay) => {
  layers = layers.filter(item => item !== layer);
};
let close = (layer: Overlay, reason: CloseReason) => {
  remove(layer);
  layer.close(reason);
  if (reason === 'escape') layer.restoreFocus?.();
};
let onPointer = (event: PointerEvent) => {
  let target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-metorial-select-content]')) return;
  let owner = lastIndex(layer => contains(layer, target));
  for (let layer of [...layers].slice(owner + 1).reverse()) {
    if (layer.outside !== false) close(layer, 'outside');
  }
};
let onKey = (event: KeyboardEvent) => {
  if (event.isComposing || event.defaultPrevented) return;
  let layer = layers[layers.length - 1];
  if (!layer || layer.nativeEscape) return;
  let target = event.target instanceof Element ? event.target : null;
  // Radix owns its portaled selects and modal keyboard handling.
  if (
    target?.closest('[data-metorial-select-content], [role="dialog"]') &&
    !layer.element()?.contains(target)
  )
    return;
  if (event.key !== 'Escape') {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let menu = layer.element();
    if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (target?.closest('input, textarea, [contenteditable="true"]')) return;
    if (!contains(layer, target)) return;
    let buttons = Array.from(
      menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    );
    if (!buttons.length) return;
    let index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : event.key === 'ArrowDown'
            ? (index + 1) % buttons.length
            : index <= 0
              ? buttons.length - 1
              : index - 1;
    event.preventDefault();
    event.stopImmediatePropagation();
    buttons[next].focus();
    buttons[next].scrollIntoView?.({ block: 'nearest' });
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  close(layer, 'escape');
};
let onBlur = () =>
  [...layers]
    .reverse()
    .filter(layer => !layer.nativeEscape)
    .forEach(layer => close(layer, 'blur'));

export let dismissEditorOverlays = () =>
  [...layers]
    .reverse()
    .filter(layer => !layer.nativeEscape)
    .forEach(layer => close(layer, 'replaced'));

export function useDismissEditorOverlays(open: boolean) {
  useEffect(() => {
    if (open) dismissEditorOverlays();
  }, [open]);
}

export function registerEditorOverlay(overlay: Overlay) {
  let trigger = overlay.trigger?.() ?? null;
  let layer = { ...overlay };
  let parent = lastIndex(item => !!trigger && !!item.element()?.contains(trigger));
  for (let item of [...layers].slice(parent + 1).reverse()) close(item, 'replaced');
  layers.push(layer);
  if (!listening) {
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    listening = true;
  }

  return () => {
    remove(layer);
    if (!layers.length && listening) {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      listening = false;
    }
  };
}

export function useEditorOverlay(open: boolean, overlay: Overlay) {
  let latest = useRef(overlay);
  latest.current = overlay;
  useEffect(() => {
    if (!open) return;
    let trigger = latest.current.trigger?.();
    return registerEditorOverlay({
      element: () => latest.current.element(),
      ...(overlay.trigger ? { trigger: () => latest.current.trigger?.() ?? null } : {}),
      close: reason => latest.current.close(reason),
      automatic: overlay.automatic,
      outside: overlay.outside,
      nativeEscape: overlay.nativeEscape,
      restoreFocus: () => {
        if (trigger?.isConnected) trigger.focus();
        else latest.current.restoreFocus?.();
      }
    });
  }, [open]);
}

export function useOverlayPosition(
  open: boolean,
  element: { current: HTMLElement | null },
  anchor: () => { left: number; top: number } | null,
  onInvalid: () => void,
  align: 'left' | 'right' = 'left'
) {
  let [position, setPosition] = useState({ left: 0, top: 0 });
  let updateRef = useRef<() => void>(() => {});
  let latest = useRef({ anchor, onInvalid });
  latest.current = { anchor, onInvalid };
  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    let update = () => {
      let point = latest.current.anchor();
      let el = element.current;
      if (!point || !Number.isFinite(point.left) || !Number.isFinite(point.top)) {
        latest.current.onInvalid();
        return;
      }
      if (!el) return;
      let rect = el.getBoundingClientRect();
      let left = align === 'right' ? point.left - rect.width : point.left;
      let next = {
        left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(point.top, window.innerHeight - rect.height - 8))
      };
      setPosition(prev => (prev.left === next.left && prev.top === next.top ? prev : next));
    };
    updateRef.current = update;
    let schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    let observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (element.current) observer?.observe(element.current);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [open, align]);
  useLayoutEffect(() => {
    if (open) updateRef.current();
  });
  return position;
}

export let preserveEditorSelection = (event: React.MouseEvent) => {
  if (
    !(event.target instanceof Element) ||
    !event.target.closest('input, textarea, select, [contenteditable="true"]')
  ) {
    event.preventDefault();
  }
};
