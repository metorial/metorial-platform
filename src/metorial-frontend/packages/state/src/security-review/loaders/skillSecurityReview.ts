import type {
  DashboardInstanceSkillsSecurityReviewGetOutput,
  DashboardInstanceSkillsSecurityReviewRevisionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import {
  clearReassess,
  requestReassess,
  useOptimisticReassess
} from '../../lib/optimisticReassess';
import { usePolling } from '../../lib/usePolling';
import { skillVersionsLoader } from '../../skills/loaders/skills';
import { useDashboardFlags } from '../../organization/loaders/flags';
import { withAuth } from '../../user';

let POLL_INTERVAL_MS = 3_000;

let reassessKey = (i: { instanceId: string; skillId: string }) =>
  `skill:${i.instanceId}:${i.skillId}`;

export type SkillSecurityReview = DashboardInstanceSkillsSecurityReviewGetOutput;

export type SkillSecurityReviewRevision = NonNullable<SkillSecurityReview['currentRevision']>;

export let isSkillSecurityReviewPending = (review: SkillSecurityReview | null | undefined) => {
  if (!review || review.verdict == 'dismissed') return false;

  let inProgress = review.inProgressRevision;
  if (inProgress) return inProgress.status == 'queued' || inProgress.status == 'running';

  return review.verdict == 'pending' && !review.currentRevision;
};

export let skillSecurityReviewRevisionsLoader = createLoader({
  name: 'skillSecurityReviewRevisions',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      skillId: string;
    } & DashboardInstanceSkillsSecurityReviewRevisionsListQuery
  ) => withAuth(sdk => sdk.skills.securityReview.revisions.list(i.instanceId, i.skillId, i)),
  mutators: {}
});

export let useSkillSecurityReviewRevisions = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  query?: DashboardInstanceSkillsSecurityReviewRevisionsListQuery
) => {
  let isEnabled = useSkillSecurityReviewsEnabled();

  return skillSecurityReviewRevisionsLoader.use(
    isEnabled && instanceId && skillId ? { ...query, instanceId, skillId } : null
  );
};

export let skillSecurityReviewLoader = createLoader({
  name: 'skillSecurityReview',
  parents: [skillSecurityReviewRevisionsLoader, skillVersionsLoader],
  fetch: (i: { instanceId: string; skillId: string }) =>
    withAuth(sdk => sdk.skills.securityReview.get(i.instanceId, i.skillId)),
  mutators: {
    reassess: async (_: void, { input, output }) => {
      requestReassess(reassessKey(input), output?.currentRevision?.id ?? null);

      try {
        return await withAuth(sdk =>
          sdk.skills.securityReview.reassess(input.instanceId, input.skillId)
        );
      } catch (error) {
        clearReassess(reassessKey(input));
        throw error;
      }
    },

    dismiss: (_: void, { input }) =>
      withAuth(sdk => sdk.skills.securityReview.dismiss(input.instanceId, input.skillId)),

    restore: (_: void, { input }) =>
      withAuth(sdk => sdk.skills.securityReview.restore(input.instanceId, input.skillId))
  }
});

export let useSkillSecurityReviewsEnabled = () => {
  let flags = useDashboardFlags();

  return (
    !!flags.data?.flags['skills-enabled'] && !!flags.data?.flags['security-reviews-enabled']
  );
};

export let useSkillSecurityReview = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined
) => {
  let isEnabled = useSkillSecurityReviewsEnabled();

  let data = skillSecurityReviewLoader.use(
    isEnabled && instanceId && skillId ? { instanceId, skillId } : null
  );

  let key = instanceId && skillId ? reassessKey({ instanceId, skillId }) : null;
  let review = useOptimisticReassess(key, data.data);

  usePolling(key, data.refetch, isSkillSecurityReviewPending(review), POLL_INTERVAL_MS);

  return {
    ...data,
    data: review ?? null,
    useReassessMutator: data.useMutator('reassess'),
    useDismissMutator: data.useMutator('dismiss'),
    useRestoreMutator: data.useMutator('restore')
  };
};

export let skillSecurityReviewRevisionLoader = createLoader({
  name: 'skillSecurityReviewRevision',
  parents: [],
  fetch: (i: { instanceId: string; skillId: string; revisionId: string }) =>
    withAuth(sdk =>
      sdk.skills.securityReview.revisions.get(i.instanceId, i.skillId, i.revisionId)
    ),
  mutators: {}
});

export let useSkillSecurityReviewRevision = (
  instanceId: string | null | undefined,
  skillId: string | null | undefined,
  revisionId: string | null | undefined
) =>
  skillSecurityReviewRevisionLoader.use(
    instanceId && skillId && revisionId ? { instanceId, skillId, revisionId } : null
  );
