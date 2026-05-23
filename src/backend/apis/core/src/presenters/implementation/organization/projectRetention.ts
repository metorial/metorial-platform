import { v } from '@mtsrc/validation';
import { Presenter } from '@metorial/presenter';
import { projectRetentionType } from '../../types';

export let v1ProjectRetentionPresenter = Presenter.create(projectRetentionType)
  .presenter(async ({ project }) => ({
    object: 'organization.project.retention_configuration' as const,

    project_id: project.id,
    log_retention_in_days: project.logRetentionInDays,
    enforce_session_expiry: project.enforceSessionExpiry,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.retention_configuration'),
      project_id: v.string(),
      log_retention_in_days: v.number(),
      enforce_session_expiry: v.boolean(),
      updated_at: v.date()
    })
  )
  .build();
