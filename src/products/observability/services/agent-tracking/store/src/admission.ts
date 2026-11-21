import { ServiceError } from '@lowerdeck/error';
import type { RecordLane } from '@mtsrc/agent-tracking-spec';
import { env } from './env';
import { sinkBusyError } from './sink';

export type LaneLimits = Record<RecordLane, number>;

export let defaultLaneLimits: LaneLimits = {
  live: env.records.liveWriteLanes,
  backfill: env.records.backfillWriteLanes
};

export type Admission = {
  run: <T>(lane: RecordLane, work: () => Promise<T>) => Promise<T>;
  inFlight: (lane: RecordLane) => number;
};

export let createAdmission = (limits: LaneLimits = defaultLaneLimits): Admission => {
  let inFlight: Record<RecordLane, number> = { live: 0, backfill: 0 };

  return {
    run: async (lane, work) => {
      if (inFlight[lane] >= limits[lane]) throw new ServiceError(sinkBusyError());

      inFlight[lane]++;

      try {
        return await work();
      } finally {
        inFlight[lane]--;
      }
    },

    inFlight: lane => inFlight[lane]
  };
};
