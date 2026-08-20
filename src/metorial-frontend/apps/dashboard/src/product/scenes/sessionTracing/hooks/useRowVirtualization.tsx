import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

let TIMELINE_OVERSCAN_RATIO = 1;
let MIN_OVERSCAN_PX = 600;

export let useRowVirtualization = ({
  scrollRef
}: {
  scrollRef: RefObject<HTMLElement | null>;
}) => {
  let [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set());
  let [forceActiveKey, setForceActiveKey] = useState<string | null>(null);
  let heightCache = useRef(new Map<string, number>());
  let observerRef = useRef<IntersectionObserver | null>(null);
  let keyByElementRef = useRef(new WeakMap<Element, string>());
  let elementByKeyRef = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // Percentage rootMargin support/behavior is inconsistent across engines,
    // so compute a concrete pixel overscan from the container's own size --
    // this is what actually determines how far ahead of the visible
    // viewport rows get activated.
    let overscanPx = Math.max(MIN_OVERSCAN_PX, scrollEl.clientHeight * TIMELINE_OVERSCAN_RATIO);

    let observer = new IntersectionObserver(
      entries => {
        setActiveKeys(current => {
          let next = new Set(current);
          let changed = false;

          for (let entry of entries) {
            let key = keyByElementRef.current.get(entry.target);
            if (!key) continue;

            if (entry.isIntersecting) {
              if (!next.has(key)) {
                next.add(key);
                changed = true;
              }
            } else if (next.has(key)) {
              next.delete(key);
              changed = true;
            }
          }

          return changed ? next : current;
        });
      },
      {
        root: scrollEl,
        rootMargin: `${overscanPx}px 0px`
      }
    );

    observerRef.current = observer;

    // Rows registered before this observer existed (initial mount) need to be
    // attached now that it's available.
    for (let [key, element] of elementByKeyRef.current) {
      keyByElementRef.current.set(element, key);
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [scrollRef]);

  // Imperative escape hatch for bulk-activating rows the moment they're
  // inserted (e.g. a page of newly-prepended pagination results), rather
  // than waiting for the observer's own async callback -- which would
  // otherwise activate them in a second, uncompensated commit right as the
  // user is scrolled near them.
  let activateKeys = useCallback((keys: string[]) => {
    if (!keys.length) return;
    setActiveKeys(current => {
      let next = new Set(current);
      let changed = false;
      for (let key of keys) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, []);

  let registerRow = useCallback((key: string, element: HTMLDivElement | null) => {
    let previousElement = elementByKeyRef.current.get(key);
    if (previousElement && previousElement !== element) {
      observerRef.current?.unobserve(previousElement);
      keyByElementRef.current.delete(previousElement);
      elementByKeyRef.current.delete(key);
    }

    if (!element) return;

    elementByKeyRef.current.set(key, element);
    keyByElementRef.current.set(element, key);
    observerRef.current?.observe(element);
  }, []);

  // Once the viewport-driven observer independently confirms the forced row
  // is in view, hand control back to it.
  useEffect(() => {
    if (!forceActiveKey) return;
    if (activeKeys.has(forceActiveKey)) setForceActiveKey(null);
  }, [activeKeys, forceActiveKey]);

  return {
    activeKeys,
    activateKeys,
    forceActiveKey,
    setForceActiveKey,
    registerRow,
    heightCache,
    elementByKey: elementByKeyRef
  };
};
