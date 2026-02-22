import {
  DashboardInstanceSessionTemplatesProvidersListOutput,
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
    i: { instanceId: string; sessionTemplateId: string } &
      DashboardInstanceSessionTemplatesProvidersListQuery
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
  let data = usePaginator(pagination =>
    sessionTemplateProvidersLoader.use(
      instanceId && sessionTemplateId ? { instanceId, sessionTemplateId, ...pagination } : null
    )
  , instanceId && sessionTemplateId ? `${instanceId}:${sessionTemplateId}` : null);

  type SessionTemplateProviderRow = DashboardInstanceSessionTemplatesProvidersListOutput['items'][number] & {
    session_template_id?: string;
  };

  let filteredItems =
    sessionTemplateId && data.data?.items
      ? data.data.items.filter((item: SessionTemplateProviderRow) => {
          let itemSessionTemplateId =
            item?.sessionTemplateId ?? item?.session_template_id ?? null;
          return itemSessionTemplateId ? itemSessionTemplateId === sessionTemplateId : true;
        })
      : data.data?.items;

  return {
    ...data,
    data: data.data
      ? {
          ...data.data,
          items: filteredItems ?? []
        }
      : data.data
  };
};

export let useDeleteSessionTemplateProvider =
  sessionTemplateProvidersLoader.createExternalMutator(
    (i: {
      instanceId: string;
      sessionTemplateId: string;
      sessionTemplateProviderId: string;
    }) =>
      withAuth(sdk => sdk.sessionTemplates.providers.delete(i.instanceId, i.sessionTemplateProviderId)),
    { disableToast: true }
  );
