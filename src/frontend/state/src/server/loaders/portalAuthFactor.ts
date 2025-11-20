import {
  DashboardInstancePortalsConsumerAuthFactorsCreateBody,
  DashboardInstancePortalsConsumerAuthFactorsListQuery,
  DashboardInstancePortalsConsumerAuthFactorsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalConsumerAuthFactorsLoader = createLoader({
  name: 'portalConsumerAuthFactors',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerAuthFactorsListQuery
  ) => withAuth(sdk => sdk.portals.consumerAuthFactors.list(i.instanceId, i.portalId, i)),
  mutators: {
    create: (
      i: DashboardInstancePortalsConsumerAuthFactorsCreateBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.consumerAuthFactors.create(instanceId, portalId, i)),

    delete: (i: { consumerAuthFactorId: string }, { input: { instanceId, portalId } }) =>
      withAuth(sdk =>
        sdk.portals.consumerAuthFactors.delete(instanceId, portalId, i.consumerAuthFactorId)
      ),

    update: (
      i: DashboardInstancePortalsConsumerAuthFactorsUpdateBody & {
        consumerAuthFactorId: string;
      },
      { input: { instanceId, portalId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerAuthFactors.update(instanceId, portalId, i.consumerAuthFactorId, i)
      )
  }
});

export let usePortalConsumerAuthFactors = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerAuthFactorsListQuery
) => {
  let data = usePaginator(pagination =>
    portalConsumerAuthFactorsLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    useCreateMutator: data.useMutator('create'),
    useDeleteMutator: data.useMutator('delete'),
    useUpdateMutator: data.useMutator('update')
  };
};

export let portalAuthFactorLoader = createLoader({
  name: 'portalAuthFactor',
  parents: [portalConsumerAuthFactorsLoader],
  fetch: (i: { instanceId: string; portalId: string; profileId: string }) =>
    withAuth(sdk =>
      sdk.portals.consumerAuthFactors.get(i.instanceId, i.portalId, i.profileId)
    ),
  mutators: {
    delete: (i: { consumerAuthFactorId: string }, { input: { instanceId, portalId } }) =>
      withAuth(sdk =>
        sdk.portals.consumerAuthFactors.delete(instanceId, portalId, i.consumerAuthFactorId)
      )
  }
});

export let usePortalConsumerAuthFactor = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  profileId: string | null | undefined
) => {
  let data = portalAuthFactorLoader.use(
    instanceId && portalId && profileId ? { instanceId, portalId, profileId } : null
  );

  return {
    ...data,
    useDeleteMutator: data.useMutator('delete')
  };
};
