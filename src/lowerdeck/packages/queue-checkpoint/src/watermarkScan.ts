import type { QueueCheckpoint } from './queueCheckpoint';

export interface WatermarkScanJob {
  cursor?: string;
  since?: string;
  startedAt?: string;
  fullPass?: true;
}

export let startWatermarkScan = async (d: {
  checkpoint: QueueCheckpoint;
  full?: boolean;
  fullPassIntervalMs?: number;
}): Promise<WatermarkScanJob> => {
  let startedAt = new Date().toISOString();

  if (d.full === true) return { startedAt };

  if (d.full !== false && (await d.checkpoint.isFullPassDue(d.fullPassIntervalMs))) {
    return { startedAt, fullPass: true };
  }

  let since = await d.checkpoint.since();

  return { startedAt, since: since?.toISOString() };
};

export let enqueueWatermarkScan = async <Extra extends Record<string, unknown> = {}>(d: {
  checkpoint: QueueCheckpoint;
  queue: { add: (job: any, opts: { id: string }) => Promise<unknown> };
  id?: string;
  full?: boolean;
  fullPassIntervalMs?: number;
  extra?: Extra;
}) => {
  let job = {
    ...d.extra,
    ...(await startWatermarkScan({
      checkpoint: d.checkpoint,
      full: d.full,
      fullPassIntervalMs: d.fullPassIntervalMs
    }))
  } as WatermarkScanJob & Extra;

  await d.queue.add(job, { id: d.id ?? 'scan' });

  if (job.fullPass) await d.checkpoint.claimFullPass(d.fullPassIntervalMs);
};

export let watermarkScanWhere = (job: Pick<WatermarkScanJob, 'since'>) =>
  job.since ? { updatedAt: { gte: new Date(job.since) } } : {};

export let commitWatermarkScan = async (d: {
  checkpoint: QueueCheckpoint;
  job: Pick<WatermarkScanJob, 'startedAt'>;
}) => {
  if (!d.job.startedAt) return;

  await d.checkpoint.commit(new Date(d.job.startedAt));
};
