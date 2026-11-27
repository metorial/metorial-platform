import type {
  DashboardInstanceSkillsMergeRequestsCommentsCreateBody,
  DashboardInstanceSkillsMergeRequestsCommentsGetOutput,
  DashboardInstanceSkillsMergeRequestsCommentsListQuery,
  DashboardInstanceSkillsMergeRequestsCommentsUpdateBody,
  DashboardInstanceSkillsMergeRequestsCreateBody,
  DashboardInstanceSkillsMergeRequestsEventsGetOutput,
  DashboardInstanceSkillsMergeRequestsEventsListQuery,
  DashboardInstanceSkillsMergeRequestsGetOutput,
  DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody,
  DashboardInstanceSkillsMergeRequestsItemsResolveBody,
  DashboardInstanceSkillsMergeRequestsListQuery,
  DashboardInstanceSkillsMergeRequestsPlanGetOutput
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type SkillMergeRequest = DashboardInstanceSkillsMergeRequestsGetOutput;
export type SkillMergeRequestPlan = DashboardInstanceSkillsMergeRequestsPlanGetOutput;
export type SkillMergeRequestComment = DashboardInstanceSkillsMergeRequestsCommentsGetOutput;
export type SkillMergeRequestEvent = DashboardInstanceSkillsMergeRequestsEventsGetOutput;

let toArrayIfString = <T extends string>(value: T | T[] | undefined) =>
  typeof value === 'string' ? [value] : value;

let normalizeSkillMergeRequestsListQuery = (
  query: DashboardInstanceSkillsMergeRequestsListQuery
): DashboardInstanceSkillsMergeRequestsListQuery => ({
  ...query,
  id: toArrayIfString(query.id),
  sourceSkillId: toArrayIfString(query.sourceSkillId),
  targetSkillId: toArrayIfString(query.targetSkillId),
  status: toArrayIfString(query.status),
  createdByActorId: toArrayIfString(query.createdByActorId)
});

export let skillMergeRequestsLoader = createLoader({
  name: 'skillMergeRequests',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceSkillsMergeRequestsListQuery) =>
    withAuth(sdk =>
      sdk.skills.mergeRequests.list(i.instanceId, normalizeSkillMergeRequestsListQuery(i))
    ),
  mutators: {}
});

export let useCreateSkillMergeRequest = skillMergeRequestsLoader.createExternalMutator(
  (i: DashboardInstanceSkillsMergeRequestsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.create(i.instanceId, i))
);

export let useSkillMergeRequests = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceSkillsMergeRequestsListQuery | null
) =>
  usePaginator(
    pagination =>
      skillMergeRequestsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    instanceId ? `${instanceId}:skillMergeRequests:${JSON.stringify(query ?? {})}` : null
  );

export let skillMergeRequestLoader = createLoader({
  name: 'skillMergeRequest',
  parents: [skillMergeRequestsLoader],
  fetch: (i: { instanceId: string; skillMergeRequestId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.get(i.instanceId, i.skillMergeRequestId)),
  mutators: {}
});

export let useSkillMergeRequest = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined
) =>
  skillMergeRequestLoader.use(
    instanceId && skillMergeRequestId ? { instanceId, skillMergeRequestId } : null
  );

export let usePerformSkillMergeRequest = skillMergeRequestLoader.createExternalMutator(
  (i: { instanceId: string; skillMergeRequestId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.perform(i.instanceId, i.skillMergeRequestId))
);

export let useCloseSkillMergeRequest = skillMergeRequestLoader.createExternalMutator(
  (i: { instanceId: string; skillMergeRequestId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.close(i.instanceId, i.skillMergeRequestId))
);

export let useRollbackSkillMergeRequest = skillMergeRequestLoader.createExternalMutator(
  (i: { instanceId: string; skillMergeRequestId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.rollback(i.instanceId, i.skillMergeRequestId))
);

export let skillMergeRequestPlanLoader = createLoader({
  name: 'skillMergeRequestPlan',
  parents: [skillMergeRequestLoader],
  fetch: (i: { instanceId: string; skillMergeRequestId: string }) =>
    withAuth(sdk => sdk.skills.mergeRequests.plan.get(i.instanceId, i.skillMergeRequestId)),
  mutators: {}
});

export let useSkillMergeRequestPlan = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined
) =>
  skillMergeRequestPlanLoader.use(
    instanceId && skillMergeRequestId ? { instanceId, skillMergeRequestId } : null
  );

export let useResolveSkillMergeRequestItem = skillMergeRequestPlanLoader.createExternalMutator(
  (
    i: DashboardInstanceSkillsMergeRequestsItemsResolveBody & {
      instanceId: string;
      skillMergeRequestId: string;
      itemId: string;
    }
  ) =>
    withAuth(sdk =>
      sdk.skills.mergeRequests.items.resolve(i.instanceId, i.skillMergeRequestId, i.itemId, i)
    )
);

export let useBulkResolveSkillMergeRequestItems =
  skillMergeRequestPlanLoader.createExternalMutator(
    (
      i: DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody & {
        instanceId: string;
        skillMergeRequestId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.skills.mergeRequests.items.bulkResolve(i.instanceId, i.skillMergeRequestId, i)
      )
  );

export let skillMergeRequestEventsLoader = createLoader({
  name: 'skillMergeRequestEvents',
  parents: [skillMergeRequestLoader, skillMergeRequestPlanLoader],
  fetch: (
    i: {
      instanceId: string;
      skillMergeRequestId: string;
    } & Omit<
      DashboardInstanceSkillsMergeRequestsEventsListQuery,
      'after' | 'before' | 'cursor'
    >
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.skills.mergeRequests.events.list(i.instanceId, i.skillMergeRequestId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100,
          order: i.order ?? 'asc'
        })
      )
    ),
  mutators: {}
});

export let useSkillMergeRequestEvents = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined,
  query?: Omit<
    DashboardInstanceSkillsMergeRequestsEventsListQuery,
    'after' | 'before' | 'cursor'
  > | null
) =>
  skillMergeRequestEventsLoader.use(
    instanceId && skillMergeRequestId && query !== null
      ? { instanceId, skillMergeRequestId, ...(query ?? {}) }
      : null
  );

export let skillMergeRequestEventLoader = createLoader({
  name: 'skillMergeRequestEvent',
  parents: [skillMergeRequestEventsLoader],
  fetch: (i: { instanceId: string; skillMergeRequestId: string; eventId: string }) =>
    withAuth(sdk =>
      sdk.skills.mergeRequests.events.get(i.instanceId, i.skillMergeRequestId, i.eventId)
    ),
  mutators: {}
});

export let useSkillMergeRequestEvent = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined,
  eventId: string | null | undefined
) =>
  skillMergeRequestEventLoader.use(
    instanceId && skillMergeRequestId && eventId
      ? { instanceId, skillMergeRequestId, eventId }
      : null
  );

export let skillMergeRequestCommentsLoader = createLoader({
  name: 'skillMergeRequestComments',
  parents: [
    skillMergeRequestLoader,
    skillMergeRequestPlanLoader,
    skillMergeRequestEventsLoader
  ],
  fetch: (
    i: {
      instanceId: string;
      skillMergeRequestId: string;
    } & DashboardInstanceSkillsMergeRequestsCommentsListQuery
  ) =>
    withAuth(sdk =>
      sdk.skills.mergeRequests.comments.list(i.instanceId, i.skillMergeRequestId, i)
    ),
  mutators: {}
});

export let useSkillMergeRequestComments = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined,
  query?: DashboardInstanceSkillsMergeRequestsCommentsListQuery | null
) =>
  skillMergeRequestCommentsLoader.use(
    instanceId && skillMergeRequestId && query !== null
      ? { instanceId, skillMergeRequestId, ...(query ?? {}) }
      : null
  );

export let useCreateSkillMergeRequestComment =
  skillMergeRequestCommentsLoader.createExternalMutator(
    (
      i: DashboardInstanceSkillsMergeRequestsCommentsCreateBody & {
        instanceId: string;
        skillMergeRequestId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.skills.mergeRequests.comments.create(i.instanceId, i.skillMergeRequestId, i)
      )
  );

export let skillMergeRequestCommentLoader = createLoader({
  name: 'skillMergeRequestComment',
  parents: [skillMergeRequestCommentsLoader],
  fetch: (i: { instanceId: string; skillMergeRequestId: string; commentId: string }) =>
    withAuth(sdk =>
      sdk.skills.mergeRequests.comments.get(i.instanceId, i.skillMergeRequestId, i.commentId)
    ),
  mutators: {}
});

export let useSkillMergeRequestComment = (
  instanceId: string | null | undefined,
  skillMergeRequestId: string | null | undefined,
  commentId: string | null | undefined
) =>
  skillMergeRequestCommentLoader.use(
    instanceId && skillMergeRequestId && commentId
      ? { instanceId, skillMergeRequestId, commentId }
      : null
  );

export let useUpdateSkillMergeRequestComment =
  skillMergeRequestCommentLoader.createExternalMutator(
    (
      i: DashboardInstanceSkillsMergeRequestsCommentsUpdateBody & {
        instanceId: string;
        skillMergeRequestId: string;
        commentId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.skills.mergeRequests.comments.update(
          i.instanceId,
          i.skillMergeRequestId,
          i.commentId,
          i
        )
      )
  );

export let useDeleteSkillMergeRequestComment =
  skillMergeRequestCommentLoader.createExternalMutator(
    (i: { instanceId: string; skillMergeRequestId: string; commentId: string }) =>
      withAuth(sdk =>
        sdk.skills.mergeRequests.comments.delete(
          i.instanceId,
          i.skillMergeRequestId,
          i.commentId
        )
      )
  );
