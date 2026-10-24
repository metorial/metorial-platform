import type { DashboardProjectsConfigureAiAnalysisUpdateBody } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

export let projectAiAnalysisConfigurationLoader = createLoader({
  name: 'projectAiAnalysisConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureAiAnalysis.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      i: DashboardProjectsConfigureAiAnalysisUpdateBody,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureAiAnalysis.update(input.organizationId, input.projectId, i)
      )
  }
});

export let useProjectAiAnalysisConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let aiAnalysisConfiguration = projectAiAnalysisConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...aiAnalysisConfiguration,
    updateMutator: aiAnalysisConfiguration.useMutator('update')
  };
};
