import { createQueue } from '@lowerdeck/queue';
import { isSecurityReviewGenerationEnabled } from '@metorial-subspace/module-security-review-request';
import { env } from '../env';
import { internalSecurityReviewRunnerService } from '../internal/securityReviewRunner';
import type { SecurityReviewRunInput } from '../lib/revisions';

let DEBOUNCE_MS = 10 * 60 * 1000;
let DETERMINISTIC_DEBOUNCE_MS = 30 * 1000;

let runSecurityReviewQueue = createQueue<SecurityReviewRunInput>({
  name: 'sub/srev/run',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 3, limiter: { max: 5, duration: 1000 } }
});

export let runSecurityReviewQueueProcessor = runSecurityReviewQueue.process(async data => {
  await internalSecurityReviewRunnerService.runSecurityReview(data);
});

// Deduplicated by key instead of a fixed job id: BullMQ keeps failed jobs, and a retained failed
// job with the same id would silently swallow every later run request for that review.
let runJobOptions = (d: {
  reviewId: string;
  immediate?: boolean;
  deterministicOnly?: boolean;
  delayMs?: number;
}) => ({
  deduplication: {
    id: `security-review${d.deterministicOnly ? '-det' : d.immediate ? '-now' : ''}-${d.reviewId}`
  },
  delay:
    d.delayMs ??
    (d.deterministicOnly ? DETERMINISTIC_DEBOUNCE_MS : d.immediate ? 0 : DEBOUNCE_MS)
});

// Automatic triggers share one debounced job per review so a burst of spec or deployment
// changes produces a single run. Immediate requests use their own job id so a pending
// debounced job can never swallow them.
export let enqueueSecurityReview = async (
  d: SecurityReviewRunInput & { immediate?: boolean; delayMs?: number }
) => {
  let { immediate, delayMs, ...job } = d;
  if (!isSecurityReviewGenerationEnabled(job.trigger)) return;

  await runSecurityReviewQueue.add(job, runJobOptions(d));
};

export let enqueueSecurityReviews = async (jobs: SecurityReviewRunInput[]) => {
  let allowed = jobs.filter(job => isSecurityReviewGenerationEnabled(job.trigger));
  if (!allowed.length) return;

  await runSecurityReviewQueue.addManyWithOps(
    allowed.map(job => ({ data: job, opts: runJobOptions(job) }))
  );
};
