import type { DashboardProjectsConfigureResourceOwnershipUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectResourceOwnershipConfigurationLoader = createLoader({
  name: 'projectResourceOwnershipConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk =>
      sdk.projects.configureResourceOwnership.get(i.organizationId, i.projectId)
    ),
  mutators: {
    update: (
      i: DashboardProjectsConfigureResourceOwnershipUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureResourceOwnership.update(
          input.organizationId,
          input.projectId,
          i
        )
      )
  }
});

export let useProjectResourceOwnershipConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let resourceOwnership = projectResourceOwnershipConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...resourceOwnership,
    updateMutator: resourceOwnership.useMutator('update')
  };
};
