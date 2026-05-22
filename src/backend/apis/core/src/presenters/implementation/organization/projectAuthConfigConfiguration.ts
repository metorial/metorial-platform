import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectAuthConfigConfigurationType } from '../../types';

export let v1ProjectAuthConfigConfigurationPresenter = Presenter.create(
  projectAuthConfigConfigurationType
)
  .presenter(async ({ project, allowAuthConfigExport, allowAuthConfigImport }) => ({
    object: 'organization.project.auth_config_configuration' as const,

    project_id: project.id,
    allow_auth_config_export: allowAuthConfigExport,
    allow_auth_config_import: allowAuthConfigImport,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.auth_config_configuration'),
      project_id: v.string(),
      allow_auth_config_export: v.boolean(),
      allow_auth_config_import: v.boolean(),
      updated_at: v.date()
    })
  )
  .build();
