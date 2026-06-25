import type { DashboardProjectsConfigureToolCallingUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectToolCallingConfigurationLoader = createLoader({
  name: 'projectToolCallingConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureToolCalling.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureToolCallingUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureToolCalling.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectToolCallingConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let toolCallingConfiguration = projectToolCallingConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...toolCallingConfiguration,
    updateMutator: toolCallingConfiguration.useMutator('update')
  };
};
