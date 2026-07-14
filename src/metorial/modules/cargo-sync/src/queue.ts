import { createCron } from '@metorial/cron';
import { createQueue } from '@metorial/queue';
import { runCargoSync } from './sync';

let cargoSyncRunId = (date = new Date()) => `cargo-sync-${date.toISOString().slice(0, 10)}`;

export let cargoSyncQueue = createQueue<{ runId: string }>({
  name: 'cargo/sync/full',
  workerOpts: {
    concurrency: 1
  }
});

export let cargoSyncQueueProcessor = cargoSyncQueue.process(async data => {
  await runCargoSync(data.runId);
});

export let cargoSyncCron = createCron(
  {
    name: 'cargo/sync/cron',
    cron: '30 14 * * *'
  },
  async () => {
    let runId = cargoSyncRunId();
    await cargoSyncQueue.add({ runId }, { id: runId });
  }
);

export let enqueueCargoSync = async (date = new Date()) => {
  let runId = cargoSyncRunId(date);
  await cargoSyncQueue.add({ runId }, { id: runId });
  return runId;
};
