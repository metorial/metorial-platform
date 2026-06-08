import { useEffect, useState } from 'react';

export type PresenceState = 'open' | 'closed';

export interface Presence {
  /** Whether the component should still be rendered (true while opening,
   *  open, or playing the exit animation). */
  shouldRender: boolean;
  /** The current presence state, suitable for a `data-state` attribute. */
  dataState: PresenceState;
}

/**
 * Tracks the open/closed presence of a component so an exit animation has
 * time to play before the component unmounts. Pass `open` from the parent
 * and use the returned `dataState` on the rendered element to switch
 * between entry and exit animations via CSS.
 */
export function usePresence(open: boolean, duration = 180): Presence {
  let [state, setState] = useState<Presence>(() => ({
    shouldRender: open,
    dataState: open ? 'open' : 'closed'
  }));

  useEffect(() => {
    if (open) {
      setState(prev =>
        prev.shouldRender && prev.dataState === 'open'
          ? prev
          : { shouldRender: true, dataState: 'open' }
      );
      return;
    }
    let cancelled = false;
    setState(prev =>
      prev.shouldRender && prev.dataState !== 'closed'
        ? { shouldRender: true, dataState: 'closed' }
        : prev
    );
    let t = window.setTimeout(() => {
      if (!cancelled) {
        setState(prev =>
          prev.shouldRender ? { shouldRender: false, dataState: 'closed' } : prev
        );
      }
    }, duration);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, duration]);

  return state;
}
