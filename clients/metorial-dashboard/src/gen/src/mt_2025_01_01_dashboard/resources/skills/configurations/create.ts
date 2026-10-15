import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsConfigurationsCreateOutput = {
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

export let mapSkillsConfigurationsCreateOutput =
  /* @__PURE__ */ mapObject<SkillsConfigurationsCreateOutput>(
    [
      'is_default',
      'allow_scripts',
      'allowed_file_extensions',
      'allow_non_standard_directories',
      'deleted_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type SkillsConfigurationsCreateBody = {
  allowScripts?: boolean | undefined;
  allowedFileExtensions?: string[] | null | undefined;
  allowNonStandardDirectories?: boolean | undefined;
};

export let mapSkillsConfigurationsCreateBody =
  /* @__PURE__ */ mapObject<SkillsConfigurationsCreateBody>([
    'allow_scripts',
    'allowed_file_extensions',
    'allow_non_standard_directories'
  ]);
