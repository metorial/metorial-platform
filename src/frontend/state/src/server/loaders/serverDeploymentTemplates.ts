import {
  DashboardInstanceServersDeploymentsTemplatesCreateBody,
  DashboardInstanceServersDeploymentsTemplatesListQuery,
  DashboardInstanceServersDeploymentsTemplatesUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverDeploymentTemplatesLoader = createLoader({
  name: 'serverDeploymentTemplates',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServersDeploymentsTemplatesListQuery) =>
    withAuth(sdk => sdk.servers.deployments.templates.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateServerDeploymentTemplate =
  serverDeploymentTemplatesLoader.createExternalMutator(
    (i: DashboardInstanceServersDeploymentsTemplatesCreateBody & { instanceId: string }) =>
      withAuth(sdk => sdk.servers.deployments.templates.create(i.instanceId, i))
  );

export let useUpdateServerDeploymentTemplate =
  serverDeploymentTemplatesLoader.createExternalMutator(
    (
      i: DashboardInstanceServersDeploymentsTemplatesUpdateBody & {
        instanceId: string;
        serverDeploymentTemplateId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.servers.deployments.templates.update(i.instanceId, i.serverDeploymentTemplateId, i)
      )
  );

export let useServerDeploymentTemplates = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServersDeploymentsTemplatesListQuery
) => {
  let data = usePaginator(pagination =>
    serverDeploymentTemplatesLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let serverDeploymentTemplateLoader = createLoader({
  name: 'serverDeploymentTemplate',
  parents: [serverDeploymentTemplatesLoader],
  fetch: (i: { instanceId: string; serverDeploymentTemplateId: string }) =>
    withAuth(sdk =>
      sdk.servers.deployments.templates.get(i.instanceId, i.serverDeploymentTemplateId)
    ),
  mutators: {
    update: (
      i: DashboardInstanceServersDeploymentsTemplatesUpdateBody,
      { input: { instanceId, serverDeploymentTemplateId } }
    ) =>
      withAuth(sdk =>
        sdk.servers.deployments.templates.update(instanceId, serverDeploymentTemplateId, i)
      )
  }
});

export let useServerDeploymentTemplate = (
  instanceId: string | null | undefined,
  serverDeploymentTemplateId: string | null | undefined
) => {
  let data = serverDeploymentTemplateLoader.use(
    instanceId && serverDeploymentTemplateId
      ? { instanceId, serverDeploymentTemplateId }
      : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
