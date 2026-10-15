import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsConfigurationsGetOutput = {
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

export let mapManagementInstanceSkillsConfigurationsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsConfigurationsGetOutput>(
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
