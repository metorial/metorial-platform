/*
import { CustomServersManagedServerTemplatesListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { useCurrentOrganization } from '../../organization';
import { withAuth } from '../../user';

export let managedServerTemplatesLoader = createLoader({
  name: 'managedServerTemplates',
  parents: [],
  fetch: (i: CustomServersManagedServerTemplatesListQuery & { organizationId: string }) =>
    withAuth(sdk => sdk.customServers.managedServerTemplates.list(i.organizationId, i)),
  mutators: {}
});

export let useManagedServerTemplates = (
  query?: CustomServersManagedServerTemplatesListQuery
) => {
  let org = useCurrentOrganization();

  let data = usePaginator(pagination =>
    managedServerTemplatesLoader.use(
      org.data
        ? {
            ...pagination,
            ...query,
            organizationId: org.data?.id!
          }
        : null
    )
  );

  return data;
};

export let managedServerTemplateLoader = createLoader({
  name: 'managedServerTemplate',
  parents: [managedServerTemplatesLoader],
  fetch: (i: { managedServerTemplateId: string; organizationId: string }) =>
    withAuth(sdk =>
      sdk.customServers.managedServerTemplates.get(i.organizationId, i.managedServerTemplateId)
    ),
  mutators: {}
});

export let useManagedServerTemplate = (managedServerTemplateId: string | null | undefined) => {
  let org = useCurrentOrganization();
  let data = managedServerTemplateLoader.use(
    managedServerTemplateId && org.data
      ? { managedServerTemplateId, organizationId: org.data.id }
      : null
  );

  return {
    ...data
  };
};
*/

// Placeholder exports to prevent import errors in consuming code
export const managedServerTemplatesLoader = null;
export const useManagedServerTemplates = () => {
  throw new Error(
    'customServers.managedServerTemplates API has been removed in the new Provider API'
  );
};
export const managedServerTemplateLoader = null;
export const useManagedServerTemplate = () => {
  throw new Error(
    'customServers.managedServerTemplates API has been removed in the new Provider API'
  );
};
