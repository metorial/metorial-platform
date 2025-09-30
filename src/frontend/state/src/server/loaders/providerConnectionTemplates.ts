import {
  ProviderOauthConnectionTemplateEvaluateBody,
  ProviderOauthConnectionTemplateListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { useCurrentOrganization } from '../../organization';
import { withAuth } from '../../user';

export let providerConnectionTemplatesLoader = createLoader({
  name: 'providerConnectionTemplates',
  parents: [],
  fetch: (i: ProviderOauthConnectionTemplateListQuery & { organizationId: string }) =>
    withAuth(sdk => sdk.providerOauth.connections.templates.list(i.organizationId, i)),
  mutators: {}
});

export let useProviderConnectionTemplates = (
  query?: ProviderOauthConnectionTemplateListQuery
) => {
  let org = useCurrentOrganization();

  let data = usePaginator(pagination =>
    providerConnectionTemplatesLoader.use(
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

export let useEvaluateProviderConnectionTemplate =
  providerConnectionTemplatesLoader.createExternalMutator(
    (
      i: ProviderOauthConnectionTemplateEvaluateBody & { providerConnectionTemplateId: string }
    ) =>
      withAuth(sdk =>
        sdk.providerOauth.connections.templates.evaluate(i.providerConnectionTemplateId, i)
      )
  );

export let providerConnectionTemplateLoader = createLoader({
  name: 'providerConnectionTemplate',
  parents: [providerConnectionTemplatesLoader],
  fetch: (i: { providerConnectionTemplateId: string; organizationId: string }) =>
    withAuth(sdk =>
      sdk.providerOauth.connections.templates.get(
        i.organizationId,
        i.providerConnectionTemplateId
      )
    ),
  mutators: {}
});

export let useProviderConnectionTemplate = (
  providerConnectionTemplateId: string | null | undefined
) => {
  let org = useCurrentOrganization();
  let data = providerConnectionTemplateLoader.use(
    providerConnectionTemplateId && org.data
      ? { providerConnectionTemplateId, organizationId: org.data.id }
      : null
  );

  return {
    ...data
  };
};
