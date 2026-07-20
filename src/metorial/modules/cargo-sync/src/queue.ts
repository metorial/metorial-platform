import { createCron } from '@metorial/cron';
import { createQueue } from '@metorial/queue';

let cargoSyncRunId = (date = new Date()) => `cargo-sync-${date.toISOString().slice(0, 10)}-v1`;

export let cargoSyncQueue = createQueue<{ runId: string }>({
  name: 'cargo/sync/full',
  workerOpts: {
    concurrency: 1
  }
});

export let cargoSyncQueueProcessor = cargoSyncQueue.process(async data => {
  // await runCargoSync(data.runId);
});

export let cargoSyncCron = createCron(
  {
    name: 'cargo/sync/cron',
    cron: '0 * * * *'
  },
  async () => {
    let runId = cargoSyncRunId();
    // await cargoSyncQueue.add({ runId }, { id: runId });
  }
);
