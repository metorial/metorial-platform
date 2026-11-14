import type {
  DashboardInstanceProvidersSecurityReviewGetOutput,
  DashboardInstanceSecurityReviewsRevisionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import {
  clearReassess,
  requestReassess,
  useIsReassessRequested,
  useOptimisticReassess
} from '../../lib/optimisticReassess';
import { usePolling } from '../../lib/usePolling';
import { useDashboardFlags } from '../../organization/loaders/flags';
import { useSecurityReviewFlagsOverride } from '../flagsOverride';
import { withAuth } from '../../user';

let POLL_INTERVAL_MS = 3_000;

let reassessKey = (i: {
  instanceId: string;
  providerId: string;
  providerVersionId?: string;
}) => `provider:${i.instanceId}:${i.providerId}:${i.providerVersionId ?? ''}`;

export type SecurityReview = DashboardInstanceProvidersSecurityReviewGetOutput;

export type SecurityReviewRevision = NonNullable<SecurityReview['currentRevision']>;

export type UsageReview = NonNullable<SecurityReview['usageReview']>;

export type UsageReviewRevision = NonNullable<UsageReview['currentRevision']>;

export let isSecurityReviewPending = (review: SecurityReview | null | undefined) => {
  if (!review || review.status == 'disabled') return false;

  let inProgress = review.inProgressRevision;
  if (inProgress) return inProgress.status == 'queued' || inProgress.status == 'running';

  // The first request lazily enqueues a review, so neither revision exists yet.
  return !review.currentRevision;
};

let usageReassessKey = (i: { instanceId: string; providerId: string }) =>
  `usage:${i.instanceId}:${i.providerId}`;

let isUsageReviewRunning = (usage: UsageReview | null | undefined) =>
  usage?.status == 'running' ||
  usage?.inProgressRevision?.status == 'queued' ||
  usage?.inProgressRevision?.status == 'running';

export let securityReviewRevisionsLoader = createLoader({
  name: 'securityReviewRevisions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      securityReviewId: string;
    } & DashboardInstanceSecurityReviewsRevisionsListQuery
  ) =>
    withAuth(sdk => sdk.securityReviews.revisions.list(i.instanceId, i.securityReviewId, i)),
  mutators: {}
});

export let useSecurityReviewRevisions = (
  instanceId: string | null | undefined,
  securityReviewId: string | null | undefined,
  query?: DashboardInstanceSecurityReviewsRevisionsListQuery
) =>
  securityReviewRevisionsLoader.use(
    instanceId && securityReviewId ? { ...query, instanceId, securityReviewId } : null
  );

export let securityReviewLoader = createLoader({
  name: 'securityReview',
  parents: [securityReviewRevisionsLoader],
  fetch: (i: { instanceId: string; providerId: string; providerVersionId?: string }) =>
    withAuth(sdk =>
      sdk.providers.securityReview.get(
        i.instanceId,
        i.providerId,
        i.providerVersionId ? { providerVersionId: i.providerVersionId } : undefined
      )
    ),
  mutators: {
    reassess: async (_: void, { input, output }) => {
      let key = reassessKey(input);
      requestReassess(key, output.currentRevision?.id ?? null);

      try {
        return await withAuth(sdk =>
          sdk.securityReviews.reassess(input.instanceId, output.id)
        );
      } catch (error) {
        clearReassess(key);
        throw error;
      }
    },

    reassessUsage: async (_: void, { input, output }) => {
      let key = usageReassessKey(input);
      requestReassess(key, output.usageReview?.currentRevision?.id ?? null);

      try {
        return await withAuth(sdk =>
          sdk.providers.securityReview.usage.reassess(input.instanceId, input.providerId)
        );
      } catch (error) {
        clearReassess(key);
        throw error;
      }
    }
  }
});

export let useSecurityReviewGenerationEnabled = () => {
  let flags = useDashboardFlags();
  let override = useSecurityReviewFlagsOverride();

  return override ? override.canGenerate : flags.useFlag('paid-ai-reviews') === true;
};

export let useSecurityReviewsEnabled = () => {
  let flags = useDashboardFlags();
  let override = useSecurityReviewFlagsOverride();

  return override ? override.reviewsEnabled : !!flags.data?.flags['security-reviews-enabled'];
};

export let useSecurityReview = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  providerVersionId?: string | null
) => {
  let isEnabled = useSecurityReviewsEnabled();
  let canGenerate = useSecurityReviewGenerationEnabled();

  let data = securityReviewLoader.use(
    isEnabled && instanceId && providerId
      ? {
          instanceId,
          providerId,
          ...(providerVersionId ? { providerVersionId } : {})
        }
      : null
  );

  let key =
    instanceId && providerId
      ? reassessKey({
          instanceId,
          providerId,
          providerVersionId: providerVersionId ?? undefined
        })
      : null;
  let review = useOptimisticReassess(key, data.data);

  let usageKey =
    instanceId && providerId ? usageReassessKey({ instanceId, providerId }) : null;
  let usageReview = useOptimisticReassess(usageKey, review?.usageReview);
  let isUsageReassessRequested = useIsReassessRequested(usageKey);

  usePolling(
    key,
    data.refetch,
    (isSecurityReviewPending(review) &&
      (canGenerate || review?.maintainedBy != 'organization')) ||
      isUsageReviewRunning(usageReview) ||
      isUsageReassessRequested,
    POLL_INTERVAL_MS
  );

  return {
    ...data,
    data: review ? { ...review, usageReview: usageReview ?? null } : null,
    useReassessMutator: data.useMutator('reassess'),
    useReassessUsageMutator: data.useMutator('reassessUsage')
  };
};

export let securityReviewRevisionLoader = createLoader({
  name: 'securityReviewRevision',
  parents: [],
  fetch: (i: { instanceId: string; securityReviewId: string; revisionId: string }) =>
    withAuth(sdk =>
      sdk.securityReviews.revisions.get(i.instanceId, i.securityReviewId, i.revisionId)
    ),
  mutators: {}
});

export let useSecurityReviewRevision = (
  instanceId: string | null | undefined,
  securityReviewId: string | null | undefined,
  revisionId: string | null | undefined
) =>
  securityReviewRevisionLoader.use(
    instanceId && securityReviewId && revisionId
      ? { instanceId, securityReviewId, revisionId }
      : null
  );
