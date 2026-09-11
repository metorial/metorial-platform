import type { DashboardProjectsConfigureDataRetentionUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectDataRetentionConfigurationLoader = createLoader({
  name: 'projectDataRetentionConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureDataRetention.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureDataRetentionUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureDataRetention.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectDataRetentionConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let dataRetentionConfiguration = projectDataRetentionConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...dataRetentionConfiguration,
    updateMutator: dataRetentionConfiguration.useMutator('update')
  };
};
