import type { DashboardProjectsConfigureAuthConfigUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectAuthConfigConfigurationLoader = createLoader({
  name: 'projectAuthConfigConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk =>
      sdk.projects.configureAuthConfig.get(i.organizationId, i.projectId)
    ),
  mutators: {
    update: (
      i: DashboardProjectsConfigureAuthConfigUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureAuthConfig.update(
          input.organizationId,
          input.projectId,
          i
        )
      )
  }
});

export let useProjectAuthConfigConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let authConfigConfiguration = projectAuthConfigConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...authConfigConfiguration,
    updateMutator: authConfigConfiguration.useMutator('update')
  };
};
