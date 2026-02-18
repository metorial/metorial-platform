import { ServersDeploymentsTemplatesListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let serverDeploymentTemplatesLoader = createLoader({
  name: 'serverDeploymentTemplates',
  parents: [],
  fetch: (i: ServersDeploymentsTemplatesListQuery) =>
    withSdk(sdk => sdk.servers.templates.list(i)),
  mutators: {}
});

export let useServerDeploymentTemplates = (query?: ServersDeploymentsTemplatesListQuery) => {
  let data = usePaginator(pagination =>
    serverDeploymentTemplatesLoader.use({ ...pagination, ...query })
  );

  return data;
};

export let serverDeploymentTemplateLoader = createLoader({
  name: 'serverDeploymentTemplate',
  parents: [],
  fetch: (i: { serverDeploymentTemplateId: string }) =>
    withSdk(sdk => sdk.servers.templates.get(i.serverDeploymentTemplateId)),
  mutators: {}
});

export let useServerDeploymentTemplate = (
  serverDeploymentTemplateId: string | null | undefined
) => {
  let data = serverDeploymentTemplateLoader.use(
    serverDeploymentTemplateId ? { serverDeploymentTemplateId } : null
  );

  return data;
};
