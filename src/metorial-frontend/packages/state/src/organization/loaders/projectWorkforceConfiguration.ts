import type { DashboardProjectsConfigureWorkforceUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectWorkforceConfigurationLoader = createLoader({
  name: 'projectWorkforceConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureWorkforce.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureWorkforceUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureWorkforce.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectWorkforceConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let workforce = projectWorkforceConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...workforce,
    updateMutator: workforce.useMutator('update')
  };
};
