import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectSkillSyncConfigurationType } from '../../types';

export let v1ProjectSkillSyncConfigurationPresenter = Presenter.create(
  projectSkillSyncConfigurationType
)
  .presenter(async ({ project }) => ({
    object: 'organization.project.skill_sync_configuration' as const,

    project_id: project.id,
    git_lfs_threshold_bytes: project.skillSyncGitLfsThresholdBytes,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.skill_sync_configuration'),
      project_id: v.string(),
      git_lfs_threshold_bytes: v.nullable(
        v.number({
          description:
            'Files at or above this size are synced to Git via LFS. Null uses the default threshold.'
        })
      ),
      updated_at: v.date()
    })
  )
  .build();
