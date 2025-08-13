import {
  ProviderOauthConnectionTemplateEvaluateBody,
  ProviderOauthConnectionTemplateListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerConnectionTemplatesLoader = createLoader({
  name: 'providerConnectionTemplates',
  parents: [],
  fetch: (i: ProviderOauthConnectionTemplateListQuery) =>
    withAuth(sdk => sdk.providerOauth.connections.templates.list(i)),
  mutators: {}
});

export let useProviderConnectionTemplates = (
  query?: ProviderOauthConnectionTemplateListQuery
) => {
  let data = usePaginator(pagination =>
    providerConnectionTemplatesLoader.use({ ...pagination, ...query })
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
  fetch: (i: { providerConnectionTemplateId: string }) =>
    withAuth(sdk =>
      sdk.providerOauth.connections.templates.get(i.providerConnectionTemplateId)
    ),
  mutators: {}
});

export let useProviderConnectionTemplate = (
  providerConnectionTemplateId: string | null | undefined
) => {
  let data = providerConnectionTemplateLoader.use(
    providerConnectionTemplateId ? { providerConnectionTemplateId } : null
  );

  return {
    ...data
  };
};
