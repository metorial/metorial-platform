import type { QueueCheckpoint } from './queueCheckpoint';

export interface WatermarkScanJob {
  cursor?: string;
  since?: string;
  startedAt?: string;
}

export let startWatermarkScan = async (d: {
  checkpoint: QueueCheckpoint;
  full?: boolean;
  fullPassIntervalMs?: number;
}): Promise<WatermarkScanJob> => {
  let startedAt = new Date().toISOString();

  if (d.full ?? (await d.checkpoint.claimFullPass(d.fullPassIntervalMs))) return { startedAt };

  let since = await d.checkpoint.since();

  return { startedAt, since: since?.toISOString() };
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
