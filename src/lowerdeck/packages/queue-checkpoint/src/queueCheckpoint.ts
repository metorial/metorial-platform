export interface QueueCheckpointRow {
  queue: string;
  processedThrough: Date;
}

export interface QueueCheckpointDelegate {
  findUnique(args: { where: { queue: string } }): Promise<QueueCheckpointRow | null>;
  upsert(args: {
    where: { queue: string };
    create: QueueCheckpointRow;
    update: { processedThrough: Date };
  }): Promise<unknown>;
}

export interface QueueCheckpointDb {
  queueCheckpoint: QueueCheckpointDelegate;
}

export let DEFAULT_CHECKPOINT_OVERLAP_MS = 5 * 60_000;
export let DEFAULT_FULL_PASS_INTERVAL_MS = 7 * 24 * 60 * 60_000;

export let createQueueCheckpoint = (d: {
  db: QueueCheckpointDb;
  queue: string;
  overlapMs?: number;
  maxLookbackMs?: number;
}) => {
  let overlapMs = d.overlapMs ?? DEFAULT_CHECKPOINT_OVERLAP_MS;

  return {
    queue: d.queue,

    // `undefined` means "no floor" — the caller should do a full sweep.
    since: async (): Promise<Date | undefined> => {
      let row = await d.db.queueCheckpoint.findUnique({ where: { queue: d.queue } });
      if (!row) return undefined;

      let since = new Date(row.processedThrough.getTime() - overlapMs);

      if (d.maxLookbackMs != null) {
        let floor = new Date(Date.now() - d.maxLookbackMs);
        if (since < floor) return floor;
      }

      return since;
    },

    commit: async (processedThrough: Date) => {
      await d.db.queueCheckpoint.upsert({
        where: { queue: d.queue },
        create: { queue: d.queue, processedThrough },
        update: { processedThrough }
      });
    },

    claimFullPass: async (intervalMs = DEFAULT_FULL_PASS_INTERVAL_MS): Promise<boolean> => {
      let marker = `${d.queue}#full-pass`;
      let now = new Date();
      let row = await d.db.queueCheckpoint.findUnique({ where: { queue: marker } });

      if (row && row.processedThrough.getTime() > now.getTime() - intervalMs) return false;

      await d.db.queueCheckpoint.upsert({
        where: { queue: marker },
        create: { queue: marker, processedThrough: now },
        update: { processedThrough: now }
      });

      return true;
    },

    reset: async () => {
      await d.db.queueCheckpoint.upsert({
        where: { queue: d.queue },
        create: { queue: d.queue, processedThrough: new Date(0) },
        update: { processedThrough: new Date(0) }
      });
    }
  };
};

export type QueueCheckpoint = ReturnType<typeof createQueueCheckpoint>;
