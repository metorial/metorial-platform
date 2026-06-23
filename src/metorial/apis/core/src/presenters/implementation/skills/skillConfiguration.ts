import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillConfigurationType } from '../../types';

export let v1SkillConfigurationPresenter = Presenter.create(skillConfigurationType)
  .presenter(async ({ skillConfiguration }) => ({
    object: 'skill.configuration' as const,
    id: skillConfiguration.id,
    is_default: skillConfiguration.isDefault,
    allow_scripts: skillConfiguration.allowScripts,
    allowed_file_extensions: skillConfiguration.allowedFileExtensions,
    allow_non_standard_directories: skillConfiguration.allowNonStandardDirectories,
    deleted_at: skillConfiguration.deletedAt,
    created_at: skillConfiguration.createdAt,
    updated_at: skillConfiguration.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.configuration', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      is_default: v.boolean(),
      allow_scripts: v.boolean(),
      allowed_file_extensions: v.array(v.string()),
      allow_non_standard_directories: v.boolean(),
      deleted_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
