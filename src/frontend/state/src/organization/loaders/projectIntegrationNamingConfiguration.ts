import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';
import { projectLoader } from './project';

type ProjectIntegrationNamingConfigurationUpdateInput = {
  useIntegrationNameInToolNames?: boolean;
};

export let projectIntegrationNamingConfigurationLoader = createLoader({
  name: 'projectIntegrationNamingConfiguration',
  parents: [projectLoader],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk =>
      sdk.projects.configureIntegrationNaming.get(i.organizationId, i.projectId)
    ),
  mutators: {
    update: (
      i: ProjectIntegrationNamingConfigurationUpdateInput,
      { input }: { input: { organizationId: string; projectId: string } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureIntegrationNaming.update(
          input.organizationId,
          input.projectId,
          i
        )
      )
  }
});

export let useProjectIntegrationNamingConfiguration = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let integrationNamingConfiguration = projectIntegrationNamingConfigurationLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return {
    ...integrationNamingConfiguration,
    updateMutator: integrationNamingConfiguration.useMutator('update')
  };
};
