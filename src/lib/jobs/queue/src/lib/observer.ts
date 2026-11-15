export type QueueJobEvent = {
  queue: string;
  outcome: 'completed' | 'failed';
  durationSeconds: number;
  waitSeconds: number | undefined;
  attempt: number;
};

export type QueueStats = {
  counts: Record<string, number>;
  oldestWaitingAgeSeconds: number;
};

type QueueObserver = {
  onJob?: (event: QueueJobEvent) => void;
  stats: Map<string, () => Promise<QueueStats>>;
};

export let queueObserver: QueueObserver = {
  onJob: undefined,
  stats: new Map()
};
