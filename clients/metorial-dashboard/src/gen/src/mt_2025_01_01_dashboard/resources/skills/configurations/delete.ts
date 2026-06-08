import { mtMap } from '@metorial/util-resource-mapper';

export type SkillsConfigurationsDeleteOutput = {
  object: 'skill.configuration';
  id: string;
  isDefault: boolean;
  allowScripts: boolean;
  allowedFileExtensions: string[];
  allowNonStandardDirectories: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsConfigurationsDeleteOutput =
  mtMap.object<SkillsConfigurationsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    allowScripts: mtMap.objectField('allow_scripts', mtMap.passthrough()),
    allowedFileExtensions: mtMap.objectField(
      'allowed_file_extensions',
      mtMap.array(mtMap.passthrough())
    ),
    allowNonStandardDirectories: mtMap.objectField(
      'allow_non_standard_directories',
      mtMap.passthrough()
    ),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

