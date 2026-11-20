import type { Clock } from '../src/lib/clock';

// Virtual time for one scheduling loop: a sleep moves the clock forward at once, so a schedule can
// be tested without waiting. Concurrent sleepers would each move it, so it is not for those.
export let createFakeClock = (start = 0): Clock & { advance: (ms: number) => void } => {
  let current = start;

  return {
    now: () => current,
    sleep: async ms => {
      current += Math.max(0, ms);
    },
    advance: ms => {
      current += ms;
    }
  };
};
