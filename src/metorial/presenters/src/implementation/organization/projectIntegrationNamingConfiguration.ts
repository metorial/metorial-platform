import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectIntegrationNamingConfigurationType } from '../../types';

export let v1ProjectIntegrationNamingConfigurationPresenter = Presenter.create(
  projectIntegrationNamingConfigurationType
)
  .presenter(async ({ project, useIntegrationNames }) => ({
    object: 'organization.project.integration_naming_configuration' as const,

    project_id: project.id,
    use_integration_name_in_tool_names: useIntegrationNames,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.integration_naming_configuration'),
      project_id: v.string(),
      use_integration_name_in_tool_names: v.boolean(),
      updated_at: v.date()
    })
  )
  .build();
