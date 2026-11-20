export let dayMs = 86_400_000;

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export let realClock: Clock = {
  now: () => performance.timeOrigin + performance.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
};
