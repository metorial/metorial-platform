import { ServiceError } from '@lowerdeck/error';
import type { RecordLane } from '@metorial/groundstation-spec';
import { sinkBusyError } from '../sink/types';

export type LaneLimits = Record<RecordLane, number>;

export let defaultLaneLimits: LaneLimits = { live: 16, backfill: 4 };

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
