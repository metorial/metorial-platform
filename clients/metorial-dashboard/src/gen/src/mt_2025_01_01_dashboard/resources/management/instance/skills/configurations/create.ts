import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsConfigurationsCreateOutput = {
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

export let mapManagementInstanceSkillsConfigurationsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsConfigurationsCreateOutput>(
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

export type ManagementInstanceSkillsConfigurationsCreateBody = {
  allowScripts?: boolean | undefined;
  allowedFileExtensions?: string[] | null | undefined;
  allowNonStandardDirectories?: boolean | undefined;
};

export let mapManagementInstanceSkillsConfigurationsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsConfigurationsCreateBody>([
    'allow_scripts',
    'allowed_file_extensions',
    'allow_non_standard_directories'
  ]);
