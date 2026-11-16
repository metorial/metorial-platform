import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

export let workspaceEase = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// Children are measured at their natural width after each commit; when a keyed child's width
// changed since the previous commit, it is pinned to the old width and transitioned to the new one.
export let useMorphWidths = (
  containerRef: RefObject<HTMLElement | null>,
  onSettled?: () => void
) => {
  let widths = useRef(new Map<string, number>());
  let onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useLayoutEffect(() => {
    let container = containerRef.current;
    if (!container) return;

    let next = new Map<string, number>();
    let children = [...container.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.key
    );

    for (let el of children) {
      if (el.dataset.morphing) {
        next.set(el.dataset.key!, widths.current.get(el.dataset.key!) ?? el.offsetWidth);
        continue;
      }

      let key = el.dataset.key!;
      let to = el.getBoundingClientRect().width;
      let from = widths.current.get(key);
      next.set(key, to);

      if (from == null || Math.abs(from - to) < 1) continue;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) continue;

      el.dataset.morphing = '1';
      el.style.width = `${from}px`;
      el.style.overflow = 'hidden';
      el.getBoundingClientRect();
      el.style.transition = `width 0.32s ${workspaceEase}`;
      el.style.width = `${to}px`;

      let timeout: number;
      let done = (event?: TransitionEvent) => {
        if (event && (event.target != el || event.propertyName != 'width')) return;
        el.removeEventListener('transitionend', done);
        window.clearTimeout(timeout);
        el.style.width = '';
        el.style.overflow = '';
        el.style.transition = '';
        delete el.dataset.morphing;
        onSettledRef.current?.();
      };

      el.addEventListener('transitionend', done);
      timeout = window.setTimeout(done, 400);
    }

    widths.current = next;
  });
};

export type PresenceState = 'entering' | 'present' | 'leaving';

export type PresenceItem<T> = { key: string; value: T; state: PresenceState };

// Keeps removed items mounted long enough to play their leave transition, and marks newly added
// items as entering for one frame so their enter transition runs from the collapsed state.
export let usePresence = <T>(
  items: { key: string; value: T }[],
  options: { leaveMs?: number; animateInitial?: boolean } = {}
) => {
  let leaveMs = options.leaveMs ?? 360;
  let mounted = useRef(false);
  let lastValues = useRef(new Map<string, T>());
  for (let item of items) lastValues.current.set(item.key, item.value);

  let [rendered, setRendered] = useState<{ key: string; state: PresenceState }[]>(() =>
    items.map(item => ({
      key: item.key,
      state: options.animateInitial ? 'entering' : 'present'
    }))
  );

  let keySignature = items.map(item => item.key).join('|');

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      if (!options.animateInitial) return;
    }

    let keys = keySignature ? keySignature.split('|') : [];

    setRendered(current => {
      let next: { key: string; state: PresenceState }[] = keys.map(key => {
        let existing = current.find(entry => entry.key == key);
        return {
          key,
          state: existing && existing.state != 'leaving' ? existing.state : 'entering'
        };
      });

      current.forEach((entry, index) => {
        if (keys.includes(entry.key)) return;
        next.splice(Math.min(index, next.length), 0, { key: entry.key, state: 'leaving' });
      });

      return next;
    });
  }, [keySignature]);

  useEffect(() => {
    if (!rendered.some(entry => entry.state == 'entering')) return;

    let frame = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setRendered(current =>
          current.map(entry =>
            entry.state == 'entering' ? { ...entry, state: 'present' } : entry
          )
        )
      )
    );

    return () => cancelAnimationFrame(frame);
  }, [rendered]);

  useEffect(() => {
    if (!rendered.some(entry => entry.state == 'leaving')) return;

    let timeout = window.setTimeout(() => {
      setRendered(current => {
        let next = current.filter(entry => entry.state != 'leaving');
        let keep = new Set(next.map(entry => entry.key));
        for (let key of lastValues.current.keys()) {
          if (!keep.has(key)) lastValues.current.delete(key);
        }
        return next;
      });
    }, leaveMs);

    return () => window.clearTimeout(timeout);
  }, [rendered, leaveMs]);

  return rendered.flatMap((entry): PresenceItem<T>[] => {
    let item = items.find(i => i.key == entry.key);
    if (item) return [{ key: entry.key, value: item.value, state: entry.state }];
    if (!lastValues.current.has(entry.key)) return [];
    return [{ key: entry.key, value: lastValues.current.get(entry.key)!, state: entry.state }];
  });
};
