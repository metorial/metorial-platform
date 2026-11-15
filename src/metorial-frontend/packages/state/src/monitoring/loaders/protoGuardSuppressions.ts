import {
  DashboardInstanceProtoGuardSuppressionsArchiveOutput,
  DashboardInstanceProtoGuardSuppressionsCreateBody,
  DashboardInstanceProtoGuardSuppressionsCreateOutput,
  DashboardInstanceProtoGuardSuppressionsListOutput,
  DashboardInstanceProtoGuardSuppressionsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let protoGuardSuppressionsLoader = createLoader({
  name: 'protoGuardSuppressions',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceProtoGuardSuppressionsListQuery
  ): Promise<DashboardInstanceProtoGuardSuppressionsListOutput> =>
    withAuth(sdk => sdk.protoGuardSuppressions.list(i.instanceId, i)),
  mutators: {
    create: (
      body: DashboardInstanceProtoGuardSuppressionsCreateBody,
      { input: { instanceId } }
    ): Promise<DashboardInstanceProtoGuardSuppressionsCreateOutput> =>
      withAuth(sdk => sdk.protoGuardSuppressions.create(instanceId, body)),

    archive: (
      i: { suppressionId: string },
      { input: { instanceId } }
    ): Promise<DashboardInstanceProtoGuardSuppressionsArchiveOutput> =>
      withAuth(sdk => sdk.protoGuardSuppressions.archive(instanceId, i.suppressionId))
  }
});

export let useProtoGuardSuppressions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProtoGuardSuppressionsListQuery | null
) => {
  let suppressions = usePaginator(
    pagination =>
      protoGuardSuppressionsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify(query ?? {})
  );

  return {
    ...suppressions,
    createMutator: suppressions.useMutator('create'),
    archiveMutator: suppressions.useMutator('archive')
  };
};
