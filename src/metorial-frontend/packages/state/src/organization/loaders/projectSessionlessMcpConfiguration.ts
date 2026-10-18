import type { DashboardProjectsConfigureSessionlessMcpUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectSessionlessMcpConfigurationLoader = createLoader({
  name: 'projectSessionlessMcpConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureSessionlessMcp.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureSessionlessMcpUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureSessionlessMcp.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectSessionlessMcpConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let sessionlessMcpConfiguration = projectSessionlessMcpConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...sessionlessMcpConfiguration,
    updateMutator: sessionlessMcpConfiguration.useMutator('update')
  };
};
