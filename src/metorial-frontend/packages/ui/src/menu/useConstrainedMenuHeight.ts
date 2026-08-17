import { useCallback, useLayoutEffect, useRef } from 'react';

export let MENU_VIEWPORT_PADDING = 20;

type MenuHeightConstraint = {
  apply: () => void;
  detach: () => void;
};

let getViewportBottom = () => {
  if (typeof window == 'undefined') return 0;

  try {
    let visualViewport = window.visualViewport;
    if (visualViewport && Number.isFinite(visualViewport.height)) {
      let offsetTop = Number.isFinite(visualViewport.offsetTop) ? visualViewport.offsetTop : 0;
      return offsetTop + visualViewport.height;
    }
  } catch {}

  let clientHeight = document.documentElement?.clientHeight;
  if (Number.isFinite(clientHeight) && clientHeight > 0) return clientHeight;

  return Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
};

export let measureMenuMaxHeight = (element: HTMLElement) => {
  if (!element.isConnected) return null;

  let rect = element.getBoundingClientRect();
  if (!Number.isFinite(rect.top)) return null;
  if (rect.width == 0 && rect.height == 0) return null;

  let topOffset = rect.top;
  let viewportBottom = getViewportBottom();
  if (!Number.isFinite(viewportBottom) || viewportBottom <= 0) return null;

  let maxHeight = Math.floor(viewportBottom - topOffset - MENU_VIEWPORT_PADDING);
  if (!Number.isFinite(maxHeight)) return null;

  return Math.max(0, maxHeight);
};

let addListener = (
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions
) => {
  try {
    target.addEventListener(type, listener, options);
    return () => {
      try {
        target.removeEventListener(type, listener, options);
      } catch {}
    };
  } catch {
    return () => {};
  }
};

export let attachMenuHeightConstraint = (element: HTMLElement): MenuHeightConstraint => {
  let frame = 0;
  let detached = false;
  let lastApplied: string | null = null;
  let cleanups: Array<() => void> = [];

  let apply = () => {
    if (detached) return;
    if (!element.isConnected) return;

    let maxHeight = measureMenuMaxHeight(element);
    if (maxHeight == null) return;

    let value = `${maxHeight}px`;
    if (lastApplied == value && element.style.maxHeight == value) return;

    lastApplied = value;
    element.style.maxHeight = value;
  };

  let schedule = () => {
    if (detached || frame) return;

    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };

  apply();

  cleanups.push(addListener(window, 'resize', schedule));
  cleanups.push(addListener(window, 'orientationchange', schedule));
  cleanups.push(addListener(window, 'scroll', schedule, { capture: true, passive: true }));
  cleanups.push(addListener(document, 'scroll', schedule, { capture: true, passive: true }));

  try {
    if (window.visualViewport) {
      cleanups.push(addListener(window.visualViewport, 'resize', schedule));
      cleanups.push(addListener(window.visualViewport, 'scroll', schedule));
    }
  } catch {
    // visualViewport can be missing or unreadable.
  }

  if (typeof ResizeObserver != 'undefined') {
    try {
      let resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(element);
      if (element.parentElement) resizeObserver.observe(element.parentElement);
      if (document.documentElement) resizeObserver.observe(document.documentElement);
      cleanups.push(() => resizeObserver.disconnect());
    } catch {
      // ResizeObserver can fail in detached documents.
    }
  }

  if (typeof MutationObserver != 'undefined') {
    try {
      let mutationObserver = new MutationObserver(schedule);
      mutationObserver.observe(element, {
        attributes: true,
        attributeFilter: ['style', 'data-side', 'data-align', 'data-state']
      });

      // Radix puts the transform on a wrapper around the content, so watch
      // that node too — otherwise repositioning would not update max-height.
      let wrapper = element.parentElement;
      if (wrapper && wrapper != document.body && wrapper != document.documentElement) {
        mutationObserver.observe(wrapper, {
          attributes: true,
          attributeFilter: ['style']
        });
      }

      cleanups.push(() => mutationObserver.disconnect());
    } catch {
      // MutationObserver can fail in detached documents.
    }
  }

  return {
    apply,
    detach: () => {
      detached = true;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;

      for (let cleanup of cleanups) cleanup();
      cleanups = [];

      if (lastApplied != null && element.style.maxHeight == lastApplied) {
        element.style.maxHeight = '';
      }
      lastApplied = null;
    }
  };
};

export let useConstrainedMenuHeight = () => {
  let constraintRef = useRef<MenuHeightConstraint | null>(null);

  let setRef = useCallback((node: HTMLDivElement | null) => {
    constraintRef.current?.detach();
    constraintRef.current = null;
    if (node) constraintRef.current = attachMenuHeightConstraint(node);
  }, []);

  useLayoutEffect(() => {
    // Child layout effects (Radix positioning) run first. Re-apply after that
    // so the first paint already uses the correct max-height.
    constraintRef.current?.apply();
  });

  useLayoutEffect(() => {
    return () => {
      constraintRef.current?.detach();
      constraintRef.current = null;
    };
  }, []);

  return setRef;
};
