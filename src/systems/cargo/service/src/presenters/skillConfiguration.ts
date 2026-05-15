import type { SkillConfigurationRecord } from '@metorial-cargo/module-skill';

export let skillConfigurationPresenter = (skillConfiguration: SkillConfigurationRecord) => ({
  object: 'cargo#skillConfiguration',
  id: skillConfiguration.id,
  isDefault: skillConfiguration.isDefault === true,
  isInternal: skillConfiguration.isInternal,
  allowScripts: skillConfiguration.allowScripts,
  allowedFileExtensions: skillConfiguration.allowedFileExtensions,
  allowNonStandardDirectories: skillConfiguration.allowNonStandardDirectories,
  deletedAt: skillConfiguration.deletedAt,
  createdAt: skillConfiguration.createdAt,
  updatedAt: skillConfiguration.updatedAt
});
