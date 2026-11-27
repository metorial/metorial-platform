import type { DashboardProjectsConfigureSkillSyncUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectSkillSyncConfigurationLoader = createLoader({
  name: 'projectSkillSyncConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureSkillSync.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureSkillSyncUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureSkillSync.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectSkillSyncConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let skillSync = projectSkillSyncConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...skillSync,
    updateMutator: skillSync.useMutator('update')
  };
};
