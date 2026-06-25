import type { DashboardProjectsConfigureRetentionUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectRetentionLoader = createLoader({
  name: 'projectRetention',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk =>
      sdk.projects.configureRetention.get(i.organizationId, i.projectId)
    ),
  mutators: {
    update: (
      i: DashboardProjectsConfigureRetentionUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureRetention.update(
          input.organizationId,
          input.projectId,
          i
        )
      )
  }
});

export let useProjectRetention = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let retention = projectRetentionLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...retention,
    updateMutator: retention.useMutator('update')
  };
};
