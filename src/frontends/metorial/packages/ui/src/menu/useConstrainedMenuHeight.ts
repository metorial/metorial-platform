import { useCallback, useLayoutEffect, useRef } from 'react';

export let MENU_VIEWPORT_PADDING = 20;
export let MENU_MAX_HEIGHT_VAR = '--metorial-menu-max-height';

let MENU_SIDES = new Set(['top', 'bottom', 'left', 'right']);

type MenuHeightConstraint = {
  apply: () => void;
  detach: () => void;
};

type MenuSide = 'top' | 'bottom' | 'left' | 'right';

let getViewportTop = () => {
  if (typeof window == 'undefined') return 0;

  try {
    let visualViewport = window.visualViewport;
    if (visualViewport && Number.isFinite(visualViewport.offsetTop)) {
      return visualViewport.offsetTop;
    }
  } catch {
    // Some embedded webviews expose visualViewport but throw when it is read.
  }

  return 0;
};

let getViewportBottom = () => {
  if (typeof window == 'undefined') return 0;

  try {
    let visualViewport = window.visualViewport;
    if (visualViewport && Number.isFinite(visualViewport.height)) {
      return getViewportTop() + visualViewport.height;
    }
  } catch {
    // Some embedded webviews expose visualViewport but throw when it is read.
  }

  let clientHeight = document.documentElement?.clientHeight;
  if (Number.isFinite(clientHeight) && clientHeight > 0) {
    return getViewportTop() + clientHeight;
  }

  if (Number.isFinite(window.innerHeight)) return getViewportTop() + window.innerHeight;

  return 0;
};

let readPositiveNumber = (value: string) => {
  let parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

let escapeSelector = (value: string) => {
  if (typeof CSS != 'undefined' && typeof CSS.escape == 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
};

let readCssPx = (node: Element | null, name: string) => {
  if (!node) return null;

  try {
    return readPositiveNumber(getComputedStyle(node).getPropertyValue(name));
  } catch {
    return null;
  }
};

let readRadixAvailableHeight = (element: HTMLElement) => {
  return (
    readCssPx(element, '--radix-dropdown-menu-content-available-height') ??
    readCssPx(element.parentElement, '--radix-dropdown-menu-content-available-height')
  );
};

let getMenuSide = (element: HTMLElement): MenuSide | null => {
  let side = element.getAttribute('data-side');
  if (side && MENU_SIDES.has(side)) return side as MenuSide;
  return null;
};

let getTriggerRect = (element: HTMLElement) => {
  try {
    let id = element.id;
    if (!id) return null;

    let trigger = document.querySelector(`[aria-controls="${escapeSelector(id)}"]`);
    if (!(trigger instanceof Element)) return null;

    let rect = trigger.getBoundingClientRect();
    if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return null;
    if (rect.width == 0 && rect.height == 0) return null;

    return rect;
  } catch {
    return null;
  }
};

export let measureMenuMaxHeight = (element: HTMLElement) => {
  if (!element.isConnected) return null;

  let rect = element.getBoundingClientRect();
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return null;
  if (rect.width == 0 && rect.height == 0) return null;

  let viewportTop = getViewportTop();
  let viewportBottom = getViewportBottom();
  if (!Number.isFinite(viewportTop) || !Number.isFinite(viewportBottom)) return null;
  if (viewportBottom <= viewportTop) return null;

  let side = getMenuSide(element);
  let triggerRect = getTriggerRect(element);
  let radixAvailable = readRadixAvailableHeight(element);
  let radixMaxHeight =
    radixAvailable != null ? radixAvailable - MENU_VIEWPORT_PADDING : null;

  // From the menu's current top down to the viewport. Stable for downward
  // menus because max-height shrinks the box from the bottom, leaving `top`
  // unchanged.
  let spaceBelow = viewportBottom - rect.top - MENU_VIEWPORT_PADDING;

  // From the viewport down to the trigger. The trigger is a stable anchor
  // for upward menus — never use rect.bottom here, or shrinking the box
  // would chase itself before Radix repositions.
  let spaceAbove = triggerRect
    ? triggerRect.top - viewportTop - MENU_VIEWPORT_PADDING
    : radixMaxHeight;

  let maxHeight: number | null;

  if (side == 'top') {
    maxHeight = spaceAbove;
  } else if (side == 'left' || side == 'right') {
    maxHeight = Math.min(
      spaceBelow,
      viewportBottom - viewportTop - MENU_VIEWPORT_PADDING * 2
    );
  } else if (side == 'bottom') {
    maxHeight = spaceBelow;
  } else if (spaceAbove != null) {
    maxHeight = Math.min(spaceBelow, spaceAbove);
  } else {
    maxHeight = spaceBelow;
  }

  if (maxHeight == null) return null;

  if (radixMaxHeight != null) {
    maxHeight = Math.min(maxHeight, radixMaxHeight);
  }

  if (!Number.isFinite(maxHeight)) return null;

  return Math.max(0, Math.floor(maxHeight));
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
    if (
      lastApplied == value &&
      element.style.getPropertyValue(MENU_MAX_HEIGHT_VAR) == value
    ) {
      return;
    }

    lastApplied = value;
    // Never write inline maxHeight — that overrides Radix's available-height
    // and is what let upward menus grow past the viewport.
    element.style.maxHeight = '';
    element.style.setProperty(MENU_MAX_HEIGHT_VAR, value);
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
        attributeFilter: ['data-side', 'data-align', 'data-state']
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

      if (lastApplied != null) {
        if (element.style.getPropertyValue(MENU_MAX_HEIGHT_VAR) == lastApplied) {
          element.style.removeProperty(MENU_MAX_HEIGHT_VAR);
        }
        if (element.style.maxHeight) element.style.maxHeight = '';
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
