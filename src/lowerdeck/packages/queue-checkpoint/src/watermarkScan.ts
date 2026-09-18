import type { QueueCheckpoint } from './queueCheckpoint';

export interface WatermarkScanJob {
  cursor?: string;
  since?: string;
  startedAt?: string;
}

export let DEFAULT_FULL_PASS_DAY = 0;

export let isFullPassDue = (d?: { dayOfWeek?: number; now?: Date }) =>
  (d?.now ?? new Date()).getUTCDay() === (d?.dayOfWeek ?? DEFAULT_FULL_PASS_DAY);

export let startWatermarkScan = async (d: {
  checkpoint: QueueCheckpoint;
  full?: boolean;
}): Promise<WatermarkScanJob> => {
  let startedAt = new Date().toISOString();
  if (d.full) return { startedAt };

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
