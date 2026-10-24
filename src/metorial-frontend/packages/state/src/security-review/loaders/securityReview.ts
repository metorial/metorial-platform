import type {
  DashboardInstanceProvidersSecurityReviewGetOutput,
  DashboardInstanceSecurityReviewsRevisionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePolling } from '../../lib/usePolling';
import { useDashboardFlags } from '../../organization/loaders/flags';
import { withAuth } from '../../user';

let POLL_INTERVAL_MS = 3_000;

export type SecurityReview = DashboardInstanceProvidersSecurityReviewGetOutput;

export type SecurityReviewRevision = NonNullable<SecurityReview['currentRevision']>;

export let isSecurityReviewPending = (review: SecurityReview | null | undefined) => {
  if (!review || review.status == 'disabled') return false;

  let inProgress = review.inProgressRevision;
  if (inProgress) return inProgress.status == 'queued' || inProgress.status == 'running';

  // The first request lazily enqueues a review, so neither revision exists yet.
  return !review.currentRevision;
};

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
    reassess: (_: void, { input, output }) =>
      withAuth(sdk => sdk.securityReviews.reassess(input.instanceId, output.id))
  }
});

export let useSecurityReviewsEnabled = () => {
  let flags = useDashboardFlags();

  return !!flags.data?.flags['security-reviews-enabled'];
};

export let useSecurityReview = (
  instanceId: string | null | undefined,
  providerId: string | null | undefined,
  providerVersionId?: string | null
) => {
  let isEnabled = useSecurityReviewsEnabled();

  let data = securityReviewLoader.use(
    isEnabled && instanceId && providerId
      ? {
          instanceId,
          providerId,
          ...(providerVersionId ? { providerVersionId } : {})
        }
      : null
  );

  usePolling(data.refetch, isSecurityReviewPending(data.data), POLL_INTERVAL_MS);

  return {
    ...data,
    useReassessMutator: data.useMutator('reassess')
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
