import {
  DashboardInstanceSessionTemplatesProvidersCreateBody,
  DashboardInstanceSessionTemplatesProvidersListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { sessionTemplatesLoader } from './sessionTemplates';

export let sessionTemplateProvidersLoader = createLoader({
  name: 'sessionTemplateProviders',
  parents: [sessionTemplatesLoader],
  fetch: (
    i: {
      instanceId: string;
      sessionTemplateId: string;
    } & DashboardInstanceSessionTemplatesProvidersListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, sessionTemplateId, ...query } = i;
      return sdk.sessionTemplates.providers.list(instanceId, {
        ...query,
        sessionTemplateId
      });
    }),
  mutators: {}
});

export let useSessionTemplateProviders = (
  instanceId: string | null | undefined,
  sessionTemplateId: string | null | undefined
) => {
  let data = usePaginator(
    pagination =>
      sessionTemplateProvidersLoader.use(
        instanceId && sessionTemplateId
          ? { instanceId, sessionTemplateId, ...pagination }
          : null
      ),
    instanceId && sessionTemplateId ? `${instanceId}:${sessionTemplateId}` : null
  );

  return data;
};

export let useCreateSessionTemplateProvider =
  sessionTemplateProvidersLoader.createExternalMutator(
    (i: { instanceId: string } & DashboardInstanceSessionTemplatesProvidersCreateBody) =>
      withAuth(sdk => sdk.sessionTemplates.providers.create(i.instanceId, i)),
    { disableToast: true }
  );

export let useDeleteSessionTemplateProvider =
  sessionTemplateProvidersLoader.createExternalMutator(
    (i: {
      instanceId: string;
      sessionTemplateId: string;
      sessionTemplateProviderId: string;
    }) =>
      withAuth(sdk =>
        sdk.sessionTemplates.providers.delete(i.instanceId, i.sessionTemplateProviderId)
      ),
    { disableToast: true }
  );
