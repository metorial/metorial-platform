import { createQueue } from '@lowerdeck/queue';
import type { SecurityReviewTrigger } from '@metorial-subspace/db';
import { env } from './env';

export * from './verdict';

export type SecurityReviewRequest =
  | { subject: 'customProviderVersion'; id: string }
  | { subject: 'provider'; id: string }
  | { subject: 'specChange'; id: string }
  | {
      subject: 'skill';
      id: string;
      trigger: SecurityReviewTrigger;
      reason?: string;
      immediateAi?: boolean;
    }
  | {
      subject: 'providerVersion';
      id: string;
      trigger: SecurityReviewTrigger;
      reason?: string;
      ensureSlate?: boolean;
    };

export let isAutoGenerationEnabled = () =>
  env.generation.SECURITY_REVIEW_AUTO_GENERATION == 'true';

// The queue lives here, without its processor, so modules that security review itself depends
// on can request a review without importing it. The processor is attached in security-review.
export let securityReviewRequestQueue = createQueue<SecurityReviewRequest>({
  name: 'sub/srev/request',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let securityReviewRequestId = (request: SecurityReviewRequest) => {
  if (request.subject == 'customProviderVersion') return `cpv:${request.id}`;
  if (request.subject == 'specChange') return `change:${request.id}`;
  if (request.subject == 'provider') return `provider:${request.id}`;
  if (request.subject == 'skill') return `skill:${request.id}:${request.trigger}`;

  return `pv:${request.id}:${request.trigger}`;
};

export let requestSecurityReview = async (request: SecurityReviewRequest) => {
  if (!isAutoGenerationEnabled()) return;

  // A failed request must never fail the caller; the hourly scanners pick the change up.
  await securityReviewRequestQueue
    .add(request, { id: securityReviewRequestId(request) })
    .catch(error => console.error('Failed to request a security review', error));
};
